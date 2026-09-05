module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // See the plugin's own comment: without this the web build is a blank page.
    plugins: ["./babel-plugin-import-meta.js"],
  };
};
