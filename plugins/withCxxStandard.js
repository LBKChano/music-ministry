const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Sets CLANG_CXX_LANGUAGE_STANDARD to c++20 for all pods.
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

        const postInstallRegex = /^post_install do \|installer\|/m;
        const patch = `  # withCxxStandard patch — set C++20 for all pods\n  installer.pods_project.targets.each do |target|\n    target.build_configurations.each do |config|\n      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'\n    end\n  end\n`;

        if (postInstallRegex.test(podfile)) {
          podfile = podfile.replace(postInstallRegex, `post_install do |installer|\n${patch}`);
        } else {
          podfile += `\npost_install do |installer|\n${patch}end\n`;
        }

        fs.writeFileSync(podfilePath, podfile);
      } catch (e) {
        console.warn('[withCxxStandard] Failed to patch Podfile:', e.message);
      }
      return config;
    },
  ]);
};
