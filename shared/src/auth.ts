import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email('Введите корректный адрес почты.')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать минимум 8 символов.')
  .max(128, 'Пароль слишком длинный.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Никнейм должен содержать минимум 2 символа.')
  .max(40, 'Никнейм слишком длинный.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
    avatarUrl: z.string().trim().max(2_000_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Нужно передать хотя бы одно поле.');

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isDemo: boolean;
  /** Average rating over received reviews; `null` while there are none. */
  rating: number | null;
  reviewCount: number;
}

export interface UserProfile extends PublicUser {
  email: string | null;
  phone: string | null;
  city: string | null;
  dealsCompleted: number;
  createdAt: string;
}

export interface PublicProfile extends PublicUser {
  city: string | null;
  dealsCompleted: number;
  memberSince: string;
}

export interface AuthResponse {
  user: UserProfile;
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
