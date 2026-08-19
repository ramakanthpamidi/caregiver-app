const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Allow HTTP to the Laravel API host (157.85.102.79:8085).
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application?.$) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
