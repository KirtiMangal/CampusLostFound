import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { loginSchema, registerSchema } from '../validators/authValidator.js';
import { loginUser, registerUser, safeUser } from '../services/authService.js';

function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('Please check the highlighted fields.', 400, 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
}

export const register = asyncHandler(async (req, res) => {
  const input = parseInput(registerSchema, req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  const input = parseInput(loginSchema, req.body);
  const result = await loginUser(input);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: safeUser(req.user) });
});

