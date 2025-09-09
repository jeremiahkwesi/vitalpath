// babel.config.cjs
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // IMPORTANT: keep this plugin last
    plugins: ["react-native-reanimated/plugin"],
  };
};