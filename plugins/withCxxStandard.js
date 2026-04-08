const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Injects CLANG_CXX_LANGUAGE_STANDARD = c++20 into the existing post_install block.
 * Required for react-native-safe-area-context 4.10.x with RN 0.81 on Old Architecture.
 */
module.exports = function withCxxStandard(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      try {
        const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
        if (!fs.existsSync(podfilePath)) return config;

        let podfile = fs.readFileSync(podfilePath, 'utf8');

        const marker = '# withCxxStandard patch';
        if (podfile.includes(marker)) return config;

        const cxxPatch = `
  # withCxxStandard patch — set C++20 for all pods
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
    end
  end
`;

        // Find the FIRST post_install block and inject at the top of it
        // This avoids creating a second post_install block
        const postInstallRegex = /^(post_install do \|installer\|)/m;
        if (postInstallRegex.test(podfile)) {
          podfile = podfile.replace(postInstallRegex, `$1${cxxPatch}`);
        } else {
          // No post_install block exists — create one
          podfile += `\npost_install do |installer|${cxxPatch}end\n`;
        }

        fs.writeFileSync(podfilePath, podfile);
      } catch (e) {
        console.warn('[withCxxStandard] Failed to patch Podfile:', e.message);
      }
      return config;
    },
  ]);
};
