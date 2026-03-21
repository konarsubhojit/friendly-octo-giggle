import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    maxConcurrency: 128,
    globals: true,
    maxWorkers: 8,
    fileParallelism: true,
    setupFiles: ["__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**", "contexts/**", "components/**", "app/**"],
      exclude: [
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "app/**/loading.tsx",
        "app/**/error.tsx",
        "lib/schema.ts",
        "lib/db.ts",
        "lib/email/providers.ts",
        "lib/constants/categories.ts",
        "lib/search-service.ts",
      ],
    },
  },
});
