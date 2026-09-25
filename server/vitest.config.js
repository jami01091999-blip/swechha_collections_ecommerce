import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads the MongoDB binary for mongodb-memory-server
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      APP_MODE: 'test',
      MONGO_DB: 'swechha_test',
      CLIENT_ORIGIN: 'http://localhost:5173,https://swechha.example',
      LOG_LEVEL: 'silent',
      // Test-only values; never used outside vitest.
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789abcdef',
      OTP_SECRET: 'test-otp-secret-0123456789abcdef0123456789abcdef01',
      ADMIN_EMAILS: 'owner@swechha.test, Second.Owner@swechha.test',
    },
  },
});
