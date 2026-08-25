import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // `agent` is the Python service; its venv ships vendored JS.
    ignores: [".next", "agent", "coverage", "dist", "frontend", "node_modules"]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    // Build-time asset generators run under Node, not in the browser bundle —
    // .js under the CommonJS loader, .mjs as ESM. Keep this scope narrow so
    // application code still follows the stricter rules above.
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);
