import { prisma } from '../_prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../_utils/logger.js';

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Helper to hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // secure salt rounds
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Helper to generate access & refresh tokens
function generateAccessToken(userId: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'kmlwj_erp_jwt_secret_key_production_2026_fallback';
  return jwt.sign({ sub: userId, email, role }, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

// Helper to hash password reset token
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function register(data: any) {
  const normalizedEmail = normalizeEmail(data.email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw { status: 400, message: 'A user with this email already exists' };
  }

  const hashedPassword = await hashPassword(data.password);
  // Self-registration must never trust a client-supplied role — that would let anyone
  // sign up as Super Admin. New accounts always start read-only; an existing Admin
  // must promote them via Users & Roles.
  const targetRoleName = 'Auditor';

  let roleRecord = await prisma.role.findUnique({ where: { name: targetRoleName } });
  if (!roleRecord) {
    roleRecord = await prisma.role.upsert({
      where: { name: targetRoleName },
      update: {},
      create: { name: targetRoleName, description: `${targetRoleName} Role` },
    });
  }

  const fullName = data.fullName || data.name || 'Operator';

  // Create user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      fullName,
      roleId: roleRecord.id,
      isActive: true,
    },
    include: {
      role: true,
    },
  });

  // Log user creation
  logger.info({ userId: user.id, email: user.email }, 'User registered');
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    fullName: user.fullName,
    role: user.role.name,
    createdAt: user.createdAt,
  };
}

export async function login(data: any) {
  const normalizedEmail = normalizeEmail(data.email);

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { role: true },
  });

  // SQA fix: do not log the submitted email, whether the user exists, or the
  // outcome of the password comparison — these logs previously created a
  // persistent, queryable trail of which emails are registered and whether
  // login attempts against them succeeded (user-enumeration via logs).

  const isGuestLogin = normalizedEmail === 'guest@erp.com';

  if (isGuestLogin) {
    if (process.env.GUEST_MODE !== 'true') {
      throw { status: 401, message: 'Invalid credentials' };
    }
    if (!user) {
      // Automatically register the guest user if they don't exist.
      // Guest access is intentionally passwordless — it is gated entirely
      // behind the admin-controlled GUEST_MODE env flag, which defaults off.
      const auditorRole = await prisma.role.findUnique({ where: { name: 'Auditor' } });
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email: 'guest@erp.com',
          password: hashedPassword,
          fullName: 'Guest Visitor',
          roleId: auditorRole?.id || (await prisma.role.findFirst())?.id || '',
          isActive: true,
        },
        include: { role: true },
      });
    }
    logger.info({ userId: user.id }, 'Guest login used (GUEST_MODE enabled)');
  } else {
    // SQA fix: unknown user, wrong password, and deactivated account now all
    // return the exact same generic 401 — previously a deactivated account
    // returned a distinct 403 message, letting an attacker enumerate which
    // emails correspond to real (if inactive) accounts. Deactivation state
    // is still fully enforced; it's just no longer disclosed to the caller.
    if (!user || !user.isActive) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    const matches = await bcrypt.compare(data.password, user.password);
    if (!matches) {
      throw { status: 401, message: 'Invalid credentials' };
    }
  }

  if (!user.isActive) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  const accessToken = generateAccessToken(user.id, user.email, user.role.name);
  const refreshTokenStr = generateRefreshTokenString();

  // Save refresh token to DB
  await prisma.refreshToken.create({
    data: {
      token: refreshTokenStr,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  logger.info({ userId: user.id }, 'User logged in');
  return {
    accessToken,
    refreshToken: refreshTokenStr,
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName,
      fullName: user.fullName,
      role: user.role.name,
    },
  };
}

export async function rotateTokens(refreshTokenStr: string) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
  });

  if (!tokenRecord) {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  if (tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
    await prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId },
      data: { revokedAt: new Date() },
    });
    
    logger.warn(
      { userId: tokenRecord.userId, tokenId: tokenRecord.id },
      'SECURITY WARNING: Refresh token reuse detected. Revoked all tokens for this user.'
    );
    throw { status: 401, message: 'Session expired or compromised' };
  }

  // Generate new tokens
  const user = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
    include: { role: true },
  });
  if (!user) {
    throw { status: 401, message: 'User not found' };
  }

  if (!user.isActive) {
    throw { status: 403, message: 'This account has been deactivated' };
  }

  const newAccessToken = generateAccessToken(user.id, user.email, user.role.name);
  const newRefreshTokenStr = generateRefreshTokenString();

  // Rotate token: Revoke old token, create new token
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshTokenStr,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  logger.info({ userId: user.id }, 'Token rotated successfully');
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshTokenStr,
  };
}

// SQA note: logout revokes the refresh token immediately, but the short-lived
// (15 min) access token is a stateless JWT with no server-side denylist, so a
// token captured before logout remains valid until it naturally expires. This
// is an accepted trade-off given the short expiry; the same revoke-refresh-
// tokens pattern is applied consistently on password change/reset.
export async function logout(refreshTokenStr: string) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
  });

  if (tokenRecord) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
    logger.info({ userId: tokenRecord.userId }, 'User logged out');
    return tokenRecord.userId;
  }
  return null;
}

export async function changePassword(userId: string, data: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const matches = await bcrypt.compare(data.oldPassword, user.password);
  if (!matches) {
    throw { status: 400, message: 'Incorrect old password' };
  }

  const hashed = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  // Revoke all existing refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId }, 'Password changed successfully');
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.info({ email }, 'Forgot password requested for non-existent email');
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashed = hashResetToken(resetToken);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: hashed,
      resetPasswordExpires: expiry,
    },
  });

  // Log reset link in terminal for development
  const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
  logger.info(`
============================================================
[DEV EMAIL SENDER MOCK]
To: ${email}
Subject: Password Reset Request
Link: ${resetLink}
Expires in: 1 Hour
============================================================
  `);
}

export async function resetPassword(data: any) {
  const hashed = hashResetToken(data.token);
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashed,
      resetPasswordExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw { status: 400, message: 'Invalid or expired reset token' };
  }

  const hashedPassword = await hashPassword(data.newPassword);
  
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  // Revoke all existing refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId: user.id }, 'Password reset successfully');
}
