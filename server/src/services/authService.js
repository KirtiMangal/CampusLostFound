import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const SALT_ROUNDS = 12;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) throw new AppError('Authentication is not configured.', 500, 'AUTH_NOT_CONFIGURED');
  return process.env.JWT_SECRET;
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  );
}

export async function registerUser({ name, email, password }) {
  getJwtSecret();
  const existingUser = await User.exists({ email });
  if (existingUser) throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email, password: passwordHash, role: 'student' });
    return { user: safeUser(user), token: createToken(user) };
  } catch (error) {
    if (error?.code === 11000) throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    throw error;
  }
}

export async function loginUser({ email, password }) {
  getJwtSecret();
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  return { user: safeUser(user), token: createToken(user) };
}

export { safeUser };
