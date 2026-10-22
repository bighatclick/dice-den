// Signs release builds with the upload key instead of the Expo template's debug key.
// The key never goes in the repo: its location and passwords come from Gradle
// properties, normally in ~/.gradle/gradle.properties:
//   DICEDEN_UPLOAD_STORE_FILE, DICEDEN_UPLOAD_STORE_PASSWORD,
//   DICEDEN_UPLOAD_KEY_ALIAS, DICEDEN_UPLOAD_KEY_PASSWORD
// Without them the release build falls back to the debug key and says so.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// withReleaseSigning';

const snippet = `
${MARKER}
def uploadStoreFile = findProperty('DICEDEN_UPLOAD_STORE_FILE')
if (uploadStoreFile) {
    android.signingConfigs.create('upload') {
        storeFile file(uploadStoreFile)
        storePassword findProperty('DICEDEN_UPLOAD_STORE_PASSWORD')
        keyAlias findProperty('DICEDEN_UPLOAD_KEY_ALIAS')
        keyPassword findProperty('DICEDEN_UPLOAD_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.upload
} else {
    logger.warn('Dice Den: DICEDEN_UPLOAD_STORE_FILE is not set, so the release build is signed with the debug key. Never upload it to a store.')
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += snippet;
    return cfg;
  });
};
