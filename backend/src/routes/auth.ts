import express from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '@/services/userService';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { EmailService } from '@/services/emailService';
import { SmsService } from '@/services/smsService';

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('phone').optional().isMobilePhone(),
  body('country_code').optional().isLength({ min: 2, max: 3 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRegistration, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { email, password, first_name, last_name, phone, country_code, currency } = req.body;

  const user = await UserService.createUser({
    email,
    password,
    first_name,
    last_name,
    phone,
    country_code,
    currency,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please check your email for verification.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        country_code: user.country_code,
        currency: user.currency,
        is_verified: user.is_verified,
      },
    },
  });
}));

// @route   POST /api/auth/login
// @desc    Authenticate user and return token
// @access  Public
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;

  const { user, token } = await UserService.authenticateUser(email, password);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        country_code: user.country_code,
        currency: user.currency,
        role: user.role,
        is_verified: user.is_verified,
        two_factor_enabled: user.two_factor_enabled,
        last_login: user.last_login,
      },
      token,
    },
  });
}));

// @route   POST /api/auth/verify-email
// @desc    Verify user email
// @access  Public
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  await UserService.verifyEmail(userId);

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
}));

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  await UserService.resetPassword(email);

  res.json({
    success: true,
    message: 'If the email exists, a password reset link has been sent.',
  });
}));

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token and new password are required',
    });
  }

  await UserService.confirmPasswordReset(token, newPassword);

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
}));

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticate, validatePasswordChange, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.userId!;

  await UserService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// @route   POST /api/auth/enable-2fa
// @desc    Enable two-factor authentication
// @access  Private
router.post('/enable-2fa', authenticate, asyncHandler(async (req, res) => {
  const userId = req.userId!;

  const { secret, qrCode } = await UserService.enableTwoFactor(userId);

  res.json({
    success: true,
    message: 'Two-factor authentication enabled',
    data: {
      secret,
      qrCode,
    },
  });
}));

// @route   POST /api/auth/verify-2fa
// @desc    Verify two-factor authentication token
// @access  Private
router.post('/verify-2fa', authenticate, asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = req.userId!;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required',
    });
  }

  const isValid = await UserService.verifyTwoFactorToken(userId, token);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid token',
    });
  }

  res.json({
    success: true,
    message: 'Token verified successfully',
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await UserService.getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        country_code: user.country_code,
        currency: user.currency,
        role: user.role,
        is_verified: user.is_verified,
        two_factor_enabled: user.two_factor_enabled,
        last_login: user.last_login,
        created_at: user.created_at,
      },
    },
  });
}));

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate token)
// @access  Private
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In a more sophisticated implementation, you would maintain a blacklist of tokens
  // For now, we'll just return success as the client should remove the token
  
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authenticate, asyncHandler(async (req, res) => {
  const user = await UserService.getUserById(req.userId!);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Generate new token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
    },
  });
}));

export default router;