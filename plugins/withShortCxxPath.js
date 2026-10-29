// Windows only: the app's C++ build folder (android/app/.cxx) nests the full
// node_modules path of each library's generated code. That runs past Windows'
// 260-character path limit and ninja fails with "mkdir ... No such file or directory".
// Building in a short folder keeps every path under the limit. The folder is
// DICE_DEN_CXX_DIR when set (scripts/build-android-test-apk.ps1 sets it), else a folder named c
// at the drive root. Other platforms are unchanged.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// withShortCxxPath';

const snippet = `
${MARKER}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    def cxxDir = System.getenv('DICE_DEN_CXX_DIR')
    android.externalNativeBuild.cmake.buildStagingDirectory = cxxDir ? new File(cxxDir) : new File(rootDir.toPath().getRoot().toFile(), 'c')
}
`;

module.exports = function withShortCxxPath(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += snippet;
    return cfg;
  });
};
