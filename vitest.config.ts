import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    env: { DATABASE_URL: "postgresql://app:app@localhost:5432/chamcong_test", DIRECT_URL: "postgresql://app:app@localhost:5432/chamcong_test" },
    fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 },
});
