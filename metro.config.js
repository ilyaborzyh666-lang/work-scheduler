const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// התעלם מתיקיית electron-app ו-dist
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /electron-app\/.*/,
  /dist-web\/.*/,
  /dist-electron\/.*/,
];

module.exports = config;
