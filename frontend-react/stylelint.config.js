/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],

  customSyntax: 'postcss-scss',

  rules: {
    // Tailwind CSS v4 特定规则
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          // Tailwind v4 核心 at-rules
          'tailwind',
          'apply',
          'layer',
          'theme',
          'utility',
          'variant',
          'custom-variant',

          // PostCSS/CSS 标准
          'config',
          'import',
          'keyframes',
          'media',
          'supports',
        ],
      },
    ],

    // 允许 Tailwind 的任意值语法（如 bg-[#123456]）
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme', 'screen'],
      },
    ],

    // 允许 CSS 嵌套（Tailwind v4 支持）
    'selector-nested-pattern': null,
    'no-descending-specificity': null,

    // 允许嵌套选择器
    'selector-type-no-unknown': [
      true,
      {
        ignore: ['custom-elements'],
      },
    ],

    // 允许 Tailwind 的 @apply 指令
    'no-invalid-position-at-import-rule': null,
    'no-invalid-position-declaration': null,

    // 允许现代 CSS 颜色语法（如 rgb(0 0 0 / 0.5)）
    'color-function-notation': 'modern',
    'alpha-value-notation': 'percentage',

    // 关闭嵌套相关的规则（因为我们使用 PostCSS 嵌套）
    'selector-class-pattern': null,
    'keyframes-name-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],

    // PostCSS 嵌套支持
    'nesting-selector-no-missing-scoping-root': null,

    // 防止 stylelint 将 @import "tailwindcss" 转为 url() 形式（会导致 TW v4 无法加载默认主题）
    'import-notation': null,

    // 其他优化
    'declaration-block-no-redundant-longhand-properties': null,
    'no-duplicate-selectors': null,
  },
}
