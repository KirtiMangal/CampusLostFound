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

  // Trust proxy configuration
  const proxySetting = process.env.TRUST_PROXY;

  if (proxySetting) {
    app.set(
      'trust proxy',
      /^\d+$/.test(proxySetting)
        ? Number(proxySetting)
        : proxySetting
    );
  }

  // Allowed frontend origins
  const allowedOrigins = (
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:5173')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Security headers
  app.use(helmet());

  // CORS configuration
  const corsOptions = {
    origin(origin, callback) {
      // Allow requests without an Origin header
      // and requests from explicitly allowed origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
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

  // Apply CORS to all requests
  app.use(cors(corsOptions));

  // Explicitly handle CORS preflight requests
  app.options(/.*/, cors(corsOptions));

  // Body parsing
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

  // Logging only during development
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

  // Routes
  app.use('/api/health', healthRoutes);

  app.use('/api/auth', authRoutes);

  app.use('/api/items', itemRoutes);

  app.use('/api/ai', aiRoutes);

  app.use('/api/claims', claimRoutes);

  app.use('/api/notifications', notificationRoutes);

  app.use('/api/reports', reportRoutes);

  app.use('/api/admin', adminRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}