const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.blockList = /$^/;
defaultConfig.resolver.sourceExts = [...defaultConfig.resolver.sourceExts, 'cjs', 'js', 'jsx', 'ts', 'tsx'];

module.exports = defaultConfig;
