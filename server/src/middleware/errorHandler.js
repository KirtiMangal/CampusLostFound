export function notFoundHandler(req, res) {
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error, _req, res, _next) {
  const bodyError = error.type === 'entity.parse.failed' || error.type === 'entity.too.large';
  const statusCode = error.statusCode || (error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500);
  if ((!error.statusCode && !bodyError) || statusCode >= 500) {
    if (process.env.NODE_ENV === 'production') console.error('Request failed:', { name: error?.name || 'Error', code: error?.code || undefined });
    else console.error(error?.stack || error);
  }
  const bodyErrorMessage = error.type === 'entity.parse.failed' ? 'Request body must be valid JSON.' : 'Request body is too large.';
  const response = {
    status: 'error',
    code: error.code || (error.type === 'entity.parse.failed' ? 'INVALID_JSON' : error.type === 'entity.too.large' ? 'REQUEST_TOO_LARGE' : 'INTERNAL_ERROR'),
    message: bodyError ? bodyErrorMessage : statusCode === 500 ? 'An unexpected server error occurred.' : error.message,
  };
  if (error.details) response.details = error.details;
  res.status(statusCode).json(response);
}
