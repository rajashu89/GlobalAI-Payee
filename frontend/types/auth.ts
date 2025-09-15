export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  countryCode: string;
  currency: string;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  countryCode?: string;
  currency?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  countryCode?: string;
  currency?: string;
  avatar?: string;
}