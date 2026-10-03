import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();
router.get('/', (_req, res) => {
  if ((process.env.NODE_ENV === 'production' || process.env.MONGO_URI) && mongoose.connection.readyState !== 1) {
    res.status(503).json({ status: 'error', message: 'Campus Lost & Found API is not ready' });
    return;
  }
  res.json({ status: 'ok', message: 'Campus Lost & Found API is running' });
});

export default router;
