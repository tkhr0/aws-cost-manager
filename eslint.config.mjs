import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/", "dist/", "out/", "dist-electron/", "electron/dist/", "electron/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-unused-vars": "off"
    }
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  }
];
