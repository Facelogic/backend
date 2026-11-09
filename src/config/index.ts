import 'dotenv/config';

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

export default {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 3000,
  db: {
    // FACELOIGC_DATABASE_URL (Neon/Supabase/etc.) takes precedence over the discrete DB_* vars.
    url: env.FACELOIGC_DATABASE_URL || undefined,
    host: env.FACELOIGC_POSTGRES_HOST,
    port: Number(env.DB_PORT) || 5432,
    database: env.DB_NAME,
    username: env.FACELOIGC_POSTGRES_USER,
    password: env.FACELOIGC_PGPASSWORD,
    ssl: env.DB_SSL === 'true',
    poolMax: Number(env.DB_POOL_MAX) || 5,
  },
  auth: {
    sessionTtlHours: Number(env.SESSION_TTL_HOURS) || 12,
    maxFailedAttempts: Number(env.AUTH_MAX_FAILED_ATTEMPTS) || 5,
    lockMinutes: Number(env.AUTH_LOCK_MINUTES) || 15,
    cookie: {
      name: env.AUTH_COOKIE_NAME || 'session',
      secure: env.AUTH_COOKIE_SECURE ? env.AUTH_COOKIE_SECURE === 'true' : isProduction,
      sameSite: (env.AUTH_COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none',
      domain: env.AUTH_COOKIE_DOMAIN || undefined,
    },
  },
  cors: {
    origins: (env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    allowAnyOrigin: !isProduction,
  },
  docs: {
    // Swagger UI at /api/docs; set SWAGGER_ENABLED=false to hide it.
    enabled: env.SWAGGER_ENABLED !== 'false',
  },
  redisUrl: env.REDIS_URL || undefined,
  s3: {
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || 'us-east-1',
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY ?? '',
    secretAccessKey: env.S3_SECRET_KEY ?? '',
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    presignExpires: Number(env.S3_PRESIGN_EXPIRES) || 900,
  },
};
