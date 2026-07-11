const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const { resolve } = require("metro-resolver");

const config = getDefaultConfig(__dirname);

// Resolver hacks ported from projects/caregiver-app for two libraries that ship
// broken source entrypoints; force Metro to their compiled CommonJS output.
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-fbsdk-next") {
    return resolve(context, "react-native-fbsdk-next/lib/commonjs/index.js", platform);
  }
  if (moduleName === "react-native-svg") {
    return resolve(context, "react-native-svg/lib/commonjs/index.js", platform);
  }
  if (typeof previousResolveRequest === "function") {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config, { input: "./global.css" });
