import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserProfile,
} from '@retrokeep/shared';
import { apiRequest } from './client';

export function fetchCurrentUser(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/v1/auth/me');
}

export function loginRequest(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: input,
  });
}

export function registerRequest(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function logoutRequest(): Promise<void> {
  return apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
}

export function logoutAllRequest(): Promise<void> {
  return apiRequest<void>('/api/v1/auth/logout-all', { method: 'POST' });
}

export function updateProfileRequest(
  input: UpdateProfileInput,
): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>('/api/v1/users/me', {
    method: 'PATCH',
    body: input,
  });
}
