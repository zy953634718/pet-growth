import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TS 基础规则
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // P1: 禁止 app/ 和 components/ 直接访问 DB 层
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/**', '@/db/**'],
              importNames: ['*'],
              message:
                '[P1] 禁止在 UI 层直接导入 DB 函数。请通过 Zustand store action 访问数据库。',
            },
          ],
        },
      ],

      // P4: 禁止超过 2 层的相对路径导入
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value=/^\\.\\.\\/\\.\\.\\/\\.\\.\\/|^\\.\\.\\/\\.\\.\\/\\.\\.\\/.*$/]",
          message:
            '[P4] 禁止使用超过 2 层的相对路径（../../../），请改用 @/ 路径别名。',
        },
      ],
    },
  },

  // child-tabs 隔离规则
  {
    files: ['app/(child-tabs)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/\\(parent-tabs\\)/**'],
              message:
                '[P2] child-tabs 屏幕禁止引用 parent-tabs 的任何内容（角色隔离原则）。',
            },
          ],
        },
      ],
    },
  },

  // parent-tabs 隔离规则
  {
    files: ['app/(parent-tabs)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/\\(child-tabs\\)/**'],
              message:
                '[P2] parent-tabs 屏幕禁止引用 child-tabs 的任何内容（角色隔离原则）。',
            },
          ],
        },
      ],
    },
  },

  // 忽略构建产物
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', '.expo/**', 'dist/**'],
  },
];
