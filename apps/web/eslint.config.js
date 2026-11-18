import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// DEC-018: colors must come from design tokens, never hardcoded in components.
const hardcodedColor = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\()/
const noHardcodedColors = [
  'error',
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=${hardcodedColor}]`,
    message:
      'Use semantic token classes (bg-primary, text-muted, ...) instead of hardcoded colors (DEC-018).',
  },
  {
    selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=${hardcodedColor}]`,
    message:
      'Use semantic token classes (bg-primary, text-muted, ...) instead of hardcoded colors (DEC-018).',
  },
  {
    selector: `JSXAttribute[name.name='style'] Literal[value=${hardcodedColor}]`,
    message: 'Use CSS variables from tokens.css instead of hardcoded colors (DEC-018).',
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/types/api.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': noHardcodedColors,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    // Test files and route tables are not HMR boundaries.
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/app/routes.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
