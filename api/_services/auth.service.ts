import { prisma } from '../_prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../_utils/logger';

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Helper to hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // secure salt rounds
}

// Helper to generate access & refresh tokens
function generateAccessToken(userId: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';
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
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw { status: 400, message: 'A user with this email already exists' };
  }

  const hashedPassword = await hashPassword(data.password);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name || null,
      role: data.role || 'ACCOUNTANT',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  // Log user creation
  logger.info({ userId: user.id, email: user.email }, 'User registered');
  return user;
}

export async function login(data: any) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  const matches = await bcrypt.compare(data.password, user.password);
  if (!matches) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  const accessToken = generateAccessToken(user.id, user.email, user.role);
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
      name: user.name,
      role: user.role,
    },
  };
}

export async function rotateTokens(refreshTokenStr: string) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenStr },
  });

  if (!tokenRecord) {
    // SECURITY ALARM: Token not found might mean it's forged or someone is trying to reuse a deleted one.
    throw { status: 401, message: 'Invalid refresh token' };
  }

  if (tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
    // REUSE DETECTION!
    // Revoke all refresh tokens for this user because their token might have been compromised.
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
  const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
  if (!user) {
    throw { status: 401, message: 'User not found' };
  }

  const newAccessToken = generateAccessToken(user.id, user.email, user.role);
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
  }
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

  // Revoke all existing refresh tokens (forces re-login across all devices for security)
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId }, 'Password changed successfully');
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Anti-enumeration: Return success even if email doesn't exist, but don't log link
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
  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
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
