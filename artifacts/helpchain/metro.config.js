const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Block Metro from watching Firebase Auth temp directories (created/deleted during bundling)
config.resolver.blockList = [
  /@firebase\+auth.*_tmp_/,
  /firebase\/auth_tmp_/,
];

module.exports = config;
