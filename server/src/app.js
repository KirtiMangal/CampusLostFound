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

  // Trust proxy
  const proxySetting = process.env.TRUST_PROXY;

  if (proxySetting) {
    app.set(
      'trust proxy',
      /^\d+$/.test(proxySetting)
        ? Number(proxySetting)
        : proxySetting
    );
  }

  // Security headers
  app.use(helmet());

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  //
  // Temporarily allow the frontend from any origin.
  // This avoids problems caused by Vercel deployment URLs
  // changing between deployments.
  //
  const corsOptions = {
    origin: true,
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

  app.use(cors(corsOptions));

  // Explicitly handle preflight requests
  app.options(/.*/, cors(corsOptions));

  // --------------------------------------------------
  // Body parsing
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
  // Routes
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
  // Error handling
  // --------------------------------------------------

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}