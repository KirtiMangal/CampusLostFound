export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const missing = ['MONGO_URI', 'CLIENT_URL', 'JWT_SECRET'].filter((key) => !env[key]?.trim());
  if (env.JWT_SECRET && Buffer.byteLength(env.JWT_SECRET, 'utf8') < 32) missing.push('JWT_SECRET (must be at least 32 bytes)');
  if (missing.length) throw new Error(`Production configuration is incomplete: ${missing.join(', ')}.`);
}
