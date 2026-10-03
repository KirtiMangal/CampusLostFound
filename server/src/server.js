import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { validateProductionConfig } from './config/securityConfig.js';
import { registerGracefulShutdown } from './utils/gracefulShutdown.js';

export async function startServer() {
  validateProductionConfig();
  const app = createApp();
  const port = Number(process.env.PORT) || 5000;

  if (process.env.NODE_ENV === 'production') {
    if (!(await connectDatabase())) {
      console.error('Production startup stopped because MongoDB is unavailable.');
      process.exitCode = 1;
      return;
    }
    return listen(app, port);
  }

  const server = listen(app, port);
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI is not set. Starting without a MongoDB connection.');
  } else {
    void connectDatabase();
  }
  return server;
}

function listen(app, port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`Campus Lost & Found API listening on port ${port}`);
  });
  registerGracefulShutdown(server);
  return server;
}

void startServer();
