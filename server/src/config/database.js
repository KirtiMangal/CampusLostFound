import mongoose from 'mongoose';

export async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('MONGO_URI is not set. Starting without a MongoDB connection.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.info('MongoDB connected successfully.');
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', { name: error?.name || 'Error', code: error?.code || undefined });
    return false;
  }
}
