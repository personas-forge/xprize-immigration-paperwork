import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

// Flat config, modeled on the personas-desktop conventions:
// strict TypeScript, react-hooks correctness, unused-vars as errors
// (with `_` escape hatch), and the Next.js core-web-vitals rule set.
export default tseslint.config(
  { ignores: [".next", "node_modules", "next-env.d.ts", "dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // We load brand fonts via <link> in the App Router root layout, which
      // applies to every page — the rule's "single page" premise (pages/_document)
      // does not hold here. Re-enable if we migrate to next/font.
      "@next/next/no-page-custom-font": "off",
    },
  }
);
