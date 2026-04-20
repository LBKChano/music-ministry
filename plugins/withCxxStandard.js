const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withCxxStandard(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = '# withCxxStandard:injected';
      if (podfile.includes(marker)) return config;

      const patch = [
        '  ' + marker,
        '  installer.pods_project.targets.each do |target|',
        '    target.build_configurations.each do |config|',
        "      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'",
        "      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'",
        '    end',
        '  end',
      ].join('\n');

      // Find the first post_install block and inject inside it
      const postInstallRegex = /(post_install do \|installer\|\n)/;
      if (postInstallRegex.test(podfile)) {
        podfile = podfile.replace(postInstallRegex, '$1' + patch + '\n');
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxxStandard] Injected C++20 settings into Podfile post_install block.');
      } else {
        // No post_install block — append one
        podfile = podfile.trimEnd() + '\n\npost_install do |installer|\n' + patch + '\nend\n';
        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxxStandard] Appended new post_install block with C++20 settings.');
      }

      return config;
    },
  ]);
};
