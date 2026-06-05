import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

const jwtSecret = required("JWT_SECRET", isProduction ? undefined : "dev-only-change-me");
if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  trustProxy: bool("TRUST_PROXY"),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "1mb",
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
};
