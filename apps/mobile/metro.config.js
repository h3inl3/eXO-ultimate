// Expo's default Metro config detects pnpm/monorepo workspaces automatically.
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
