// Vitest: unit (pure logic), db (real Postgres in-memory via PGlite), ui (React components in jsdom).
//   npm test            all suites once        npm run test:watch   re-run on save
//   npm run test:db     database suite only    npm run test:coverage  with coverage report
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  // Next.js lets .js files contain JSX; tell Vite's transformer the same
  oxc: { include: /\.(js|jsx)$/, exclude: /node_modules/, lang: "jsx", jsx: { runtime: "automatic" } },
  test: {
    coverage: { provider: "v8", include: ["lib/**", "db/**", "components/**"], reporter: ["text", "html"] },
    projects: [
      { extends: true, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.{js,jsx}"] } },
      { extends: true, test: { name: "db", environment: "node", include: ["tests/db/**/*.test.js"], testTimeout: 30000, hookTimeout: 30000 } },
      { extends: true, test: { name: "ui", environment: "jsdom", include: ["tests/ui/**/*.test.jsx"], setupFiles: ["tests/helpers/setup-ui.js"] } },
    ],
  },
});
