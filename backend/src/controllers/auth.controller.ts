import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({
      status: 201,
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({
      status: 200,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: { message: 'Refresh token is required', status: 400 } });
      return;
    }
    const result = await authService.rotateTokens(refreshToken);
    res.status(200).json({
      status: 200,
      message: 'Token refreshed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.status(200).json({
      status: 200,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: { message: 'Unauthorized', status: 401 } });
      return;
    }
    await authService.changePassword(userId, req.body);
    res.status(200).json({
      status: 200,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.forgotPassword(req.body.email);
    res.status(200).json({
      status: 200,
      message: 'If the email exists, a password reset link has been generated and printed to server logs.',
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body);
    res.status(200).json({
      status: 200,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
}
