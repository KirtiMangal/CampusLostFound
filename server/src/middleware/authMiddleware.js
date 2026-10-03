import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token, extra] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token || extra) throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  if (!process.env.JWT_SECRET) throw new AppError('Authentication is not configured.', 500, 'AUTH_NOT_CONFIGURED');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');
  }
  if (!payload?.userId) throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');

  let user;
  try {
    user = await User.findById(payload.userId).select('name email role isActive');
  } catch (error) {
    if (error?.name === 'CastError') throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');
    throw error;
  }
  if (!user) throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');
  if (!user.isActive) throw new AppError('This account is inactive.', 401, 'ACCOUNT_INACTIVE');

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('Authentication required.', 401, 'AUTH_REQUIRED'));
    if (!roles.includes(req.user.role)) return next(new AppError('You do not have permission to access this resource.', 403, 'FORBIDDEN'));
    return next();
  };
}
