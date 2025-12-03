import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "build",
    ".vite",
    "coverage",
    ".nyc_output",
    "node_modules",
    "*.generated.ts",
    "src/types/api.generated.ts",
    "*.min.js",
    "*.bundle.js",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      jsdoc,
    },
    rules: {
      // Architecture Guard: Component Layer Boundaries
      // Prevents components/ (presentational) from importing features/ (business logic)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/features/**"],
              message:
                "Components (presentational layer) must not import from features (business logic layer). " +
                "Use props/callbacks for data and event handling instead.",
            },
            {
              group: ["**/services/**"],
              message:
                "Components must not directly import services. " +
                "Use custom hooks from features/ layer to access services.",
            },
          ],
        },
      ],
      // JSDoc enforcement for Article V (Documentation) compliance
      // Currently set to "off" - enable incrementally as documentation is added
      // Full enforcement would require ~120 JSDoc additions
      "jsdoc/require-jsdoc": [
        "off", // TODO: Enable after adding missing JSDoc comments
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          contexts: ["ExportNamedDeclaration"],
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      // Validation rules (check existing JSDoc for correctness)
      // Note: check-param-names disabled due to complex destructured props
      // TODO: Fix existing JSDoc to document all destructured parameters
      "jsdoc/check-param-names": "off",
      "jsdoc/check-types": "warn",
      "jsdoc/valid-types": "warn",
    },
  },
  // Override for EditorCore: Integration layer that coordinates services
  {
    files: ["**/components/Editor/EditorCore.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override for hooks: Custom hooks ARE the abstraction layer for services
  {
    files: ["**/hooks/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/features/**"],
              message:
                "Hooks should not import from features layer. Keep hooks focused on single responsibilities.",
            },
          ],
        },
      ],
    },
  },
  // Editor infra utilities need direct service access
  {
    files: [
      "**/components/Editor/LockDecorations.ts",
      "**/components/Editor/TransactionFilter.ts",
      "**/utils/prosemirror-helpers.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Test files: Relax JSDoc requirements
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/e2e/**/*.{ts,tsx}"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
    },
  },
]);
