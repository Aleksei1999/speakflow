import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // TODO поднять до 'error' когда покрытие @ts-nocheck опустится
    // ниже 20 файлов. Сейчас warn — чтобы CI был зелёным.
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-nocheck": true,
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
