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
      ADMIN_KEY: 'test-admin-key',
      CLIENT_ORIGIN: 'http://localhost:5173,https://swechha.example',
      LOG_LEVEL: 'silent',
    },
  },
});
