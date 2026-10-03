import mongoose from 'mongoose';

export function registerGracefulShutdown(server, {
  signalTarget = process,
  disconnectDatabase = () => mongoose.disconnect(),
  logger = console,
  timeoutMs = 10_000,
} = {}) {
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received; shutting down gracefully.`);
    const forceCloseTimer = setTimeout(() => server.closeAllConnections(), timeoutMs);
    forceCloseTimer.unref();
    server.close(async (error) => {
      clearTimeout(forceCloseTimer);
      if (error) {
        logger.error('HTTP server shutdown failed:', { name: error.name || 'Error', code: error.code || undefined });
        signalTarget.exitCode = 1;
      }
      try {
        await disconnectDatabase();
      } catch (disconnectError) {
        logger.error('MongoDB shutdown failed:', { name: disconnectError?.name || 'Error', code: disconnectError?.code || undefined });
        signalTarget.exitCode = 1;
      }
    });
  };
  signalTarget.once('SIGTERM', () => shutdown('SIGTERM'));
  signalTarget.once('SIGINT', () => shutdown('SIGINT'));
}
