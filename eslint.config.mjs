import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'

export default tseslint.config(
  { ignores: ['build', 'public', '.cache', 'playwright-report', 'test-results', 'src/gatsby-types.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        // Head, query, config, and getServerData are Gatsby page API exports.
        { allowConstantExport: true, allowExportNames: ['Head', 'query', 'config', 'getServerData'] },
      ],
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // TypeScript already checks props.
      'react/prop-types': 'off',
      // Allows `const { omitted, ...rest } = props` to drop a prop.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // Conflicts with no-non-null-assertion (strict): fixing one triggers the other.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    },
  },
  {
    // Fast refresh only applies to app modules, not tests, mocks, or test utilities.
    files: ['**/*.test.{ts,tsx}', 'e2e/**', '__mocks__/**', 'src/test-utils/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
