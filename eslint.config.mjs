import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// ESLint 10 只支持 flat config（.eslintrc.json 已被移除），本文件是原配置的原样迁移。

/** 参与 lint 的文件类型：flat config 不再用 --ext，靠 files 决定范围。 */
const LINTED_FILES = ['**/*.{js,mjs,cjs,jsx,ts,tsx}'];

/**
 * 给没有 files 的插件预设补上 files。
 *
 * flat config 里不带 files 的配置只对默认的 js/mjs/cjs 生效，不补的话 TS 文件
 * 会整片漏检（旧配置靠 --ext 覆盖这个范围）。
 */
const applyToLintedFiles = (config) => (config.files ? config : { ...config, files: LINTED_FILES });

export default [
    {
        ignores: [
            // shadcn 生成的第三方组件代码，按仓库约定不参与 lint
            'src/fronted/components/ui/**',
            'my-new-app/**',
            'node_modules/**',
            '.vite/**',
            'out/**',
            'dist/**',
            'build/**',
            'resources/**',
            '**/*.md',
            'vite.*.config.ts',
        ],
    },

    ...[
        js.configs.recommended,
        ...tseslint.configs['flat/recommended'],
        importPlugin.flatConfigs.recommended,
        importPlugin.flatConfigs.electron,
        importPlugin.flatConfigs.typescript,
        react.configs.flat.recommended,
        reactHooks.configs.flat.recommended,
        jsxA11y.flatConfigs.recommended,
    ].map(applyToLintedFiles),

    {
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            // 对应旧 eslintrc 的 env: browser / es6 / node
            globals: {
                ...globals.browser,
                ...globals.es2015,
                ...globals.node,
            },
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                    paths: ['src'],
                },
                alias: {
                    map: [['@', './src']],
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                },
            },
            react: {
                version: 'detect',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'react/react-in-jsx-scope': 'off',
            'react/jsx-uses-react': 'off',
            'jsx-a11y/anchor-is-valid': 'warn',
            'jsx-a11y/click-events-have-key-events': 'warn',
            'jsx-a11y/mouse-events-have-key-events': 'warn',
            'jsx-a11y/no-static-element-interactions': 'warn',
            'jsx-a11y/no-noninteractive-tabindex': 'warn',
            'jsx-a11y/label-has-associated-control': 'warn',
            'jsx-a11y/alt-text': 'warn',
        },
    },

    // 业务层不许直接伸手到 electron 客户端，调用必须收口到当前 feature 的 *Api.ts
    {
        files: ['src/fronted/features/**/*.{ts,tsx}'],
        ignores: ['src/fronted/features/**/*Api.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@/fronted/infrastructure/electron/backendClient',
                            message: '业务调用请收口到当前 feature 的 *Api.ts 文件。',
                        },
                    ],
                    patterns: [
                        {
                            group: ['qa/**', '../qa/**', '../../qa/**', '../../../qa/**'],
                            message: '产品代码不许 import qa/ 下的用例资产。',
                        },
                    ],
                },
            ],
        },
    },

    // src 下非 feature 的代码同样不许 import qa/
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/fronted/features/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['qa/**', '../qa/**', '../../qa/**', '../../../qa/**'],
                            message: '产品代码不许 import qa/ 下的用例资产。',
                        },
                    ],
                },
            ],
        },
    },

    // qa/ 只依赖 @/common，不许绕进产品内部实现
    {
        files: ['qa/**/*.{ts,tsx,mjs,js}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@/fronted',
                                '@/fronted/**',
                                '@/backend',
                                '@/backend/**',
                                '@/app',
                                '@/app/**',
                                '@/test',
                                '@/test/**',
                            ],
                            message:
                                'qa/ 只依赖 @/common 的类型与常量：运行期契约走 window.__dpDebug 与 URL 参数，不许直接读产品内部实现（产品一重构，用例就跟着烂）。',
                        },
                        {
                            group: ['**/src/fronted/**', '**/src/backend/**', '**/src/app/**', '**/src/test/**'],
                            message: 'qa/ 不许用相对路径绕到 src 的内部实现；只允许 ../../src/common/**。',
                        },
                    ],
                },
            ],
            'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
            'react-hooks/rules-of-hooks': 'off',
        },
    },

    // 测试里禁止留 only
    {
        files: ['src/**/__tests__/**/*.{ts,tsx,js,jsx}', 'src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.object.name=/^(describe|it|test)$/][callee.property.name='only']",
                    message: '禁止提交 describe.only / it.only / test.only，调试完请移除。',
                },
            ],
        },
    },
];
