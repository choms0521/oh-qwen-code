import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.js", "**/*.mjs"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-case-declarations": "warn",
      "no-prototype-builtins": "warn",
      "no-async-promise-executor": "warn",
      "no-constant-condition": "warn",
      "no-ex-assign": "warn",
      "no-loss-of-precision": "warn",
      "no-useless-catch": "warn",
      "no-redeclare": "warn",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "coverage/",
      "skills/",
      "agents/",
      "commands/",
    ],
  },
];
