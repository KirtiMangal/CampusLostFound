import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name must be 100 characters or fewer.'),
  email: z.string().trim().email('Enter a valid university email.').max(254, 'Email is too long.').transform((value) => value.toLowerCase()),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254, 'Email is too long.').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password.').max(72, 'Invalid email or password.'),
});
