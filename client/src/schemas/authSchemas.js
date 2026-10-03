import { z } from 'zod';

const email = z.string().trim().email('Enter a valid university email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Password must be 72 characters or fewer.');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name must be 100 characters or fewer.'),
  email,
  password,
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') });
