const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCxxStandard(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = '# withCxxStandard';
      if (podfile.includes(marker)) return config;

      const cxxPatch = `
  # ${marker}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
    end
  end
`;

      // Find the LAST post_install block's opening line and inject after it
      // This ensures we run after all other plugins have added their content
      const lines = podfile.split('\n');
      let lastPostInstallIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\s*post_install\s+do\s+\|installer\|/)) {
          lastPostInstallIdx = i;
        }
      }

      if (lastPostInstallIdx >= 0) {
        lines.splice(lastPostInstallIdx + 1, 0, cxxPatch);
        podfile = lines.join('\n');
      } else {
        podfile += `\npost_install do |installer|\n${cxxPatch}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile);
      console.log('[withCxxStandard] Injected C++20 into Podfile.');
      return config;
    },
  ]);
};
