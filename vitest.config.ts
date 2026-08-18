import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // The contract specs moved in from packages/contracts use bare
    // describe/it/expect, as they did under jest. Existing dashboard tests
    // import them explicitly, which keeps working either way.
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    exclude: [...configDefaults.exclude, "ClaudeDesignSystem/**", ".next/**"],
  },
});
