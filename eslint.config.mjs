import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/", "dist/", "out/", "dist-electron/", "electron/dist/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-unused-vars": "off"
    }
  }
];
