import { defineConfig } from "vitest/config";

/**
 * Coverage is scoped to modules exercised by unit tests. Entry points (`background`, `content`),
 * the React popup shell, and shadcn UI primitives are excluded so thresholds reflect logic we test
 * in Node rather than E2E browser targets.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "src/vite-env.d.ts",
        "src/background.ts",
        "src/content.ts",
        "src/popup/App.tsx",
        "src/popup/main.tsx",
        "src/popup/theme-boot.ts",
        "src/components/**",
        "src/popup/components/**",
      ],
      thresholds: {
        lines: 98,
        statements: 98,
        branches: 97,
        functions: 95,
      },
    },
  },
});
