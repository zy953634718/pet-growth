module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Fix: zustand v5 devtools uses `import.meta.env` (Vite-only syntax)
      // This plugin replaces import.meta with safe fallbacks for Metro/Web.
      require.resolve('./babel-plugin-replace-import-meta.js'),
    ],
    sourceType: 'module',
    plugins: [],
  };
};
