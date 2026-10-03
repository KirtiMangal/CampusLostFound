import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

import {
  errorHandler,
  notFoundHandler
} from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // --------------------------------------------------
  // Trust proxy configuration
  // --------------------------------------------------

  const proxySetting = process.env.TRUST_PROXY;

  if (proxySetting) {
    app.set(
      'trust proxy',
      /^\d+$/.test(proxySetting)
        ? Number(proxySetting)
        : proxySetting
    );
  }

  // --------------------------------------------------
  // CORS configuration
  // --------------------------------------------------

  const allowedOrigins = (
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:5173')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // --------------------------------------------------
  // Security headers
  // --------------------------------------------------

  app.use(helmet());

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  const corsOptions = {
    origin(origin, callback) {
      // Allow requests that do not contain an Origin header.
      // This is useful for server-to-server requests and
      // direct health checks.
      if (!origin) {
        return callback(null, true);
      }

      // Allow only explicitly configured frontend origins.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject untrusted origins without throwing an error.
      // This allows the security tests to verify that
      // untrusted origins do not receive CORS headers.
      return callback(null, false);
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  };

  // Apply CORS to normal requests.
  app.use(cors(corsOptions));

  // Explicitly handle browser preflight requests.
  app.options(/.*/, cors(corsOptions));

  // --------------------------------------------------
  // Request body parsing
  // --------------------------------------------------

  app.use(
    express.json({
      limit: '32kb'
    })
  );

  app.use(
    express.urlencoded({
      extended: false,
      limit: '8kb',
      parameterLimit: 100
    })
  );

  // --------------------------------------------------
  // Development logging
  // --------------------------------------------------

  if (process.env.NODE_ENV !== 'production') {
    app.use(
      morgan(
        (tokens, req, res) =>
          `${tokens.method(req, res)} ${
            req.originalUrl.split('?')[0]
          } ${tokens.status(req, res)} ${
            tokens['response-time'](req, res)
          } ms`
      )
    );
  }

  // --------------------------------------------------
  // API routes
  // --------------------------------------------------

  app.use('/api/health', healthRoutes);

  app.use('/api/auth', authRoutes);

  app.use('/api/items', itemRoutes);

  app.use('/api/ai', aiRoutes);

  app.use('/api/claims', claimRoutes);

  app.use('/api/notifications', notificationRoutes);

  app.use('/api/reports', reportRoutes);

  app.use('/api/admin', adminRoutes);

  // --------------------------------------------------
  // 404 handler
  // --------------------------------------------------

  app.use(notFoundHandler);

  // --------------------------------------------------
  // Global error handler
  // --------------------------------------------------

  app.use(errorHandler);

  return app;
}