import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
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
]);
