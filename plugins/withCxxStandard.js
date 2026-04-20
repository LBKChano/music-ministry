/**
 * withCxxStandard.js
 *
 * Injects CLANG_CXX_LANGUAGE_STANDARD = c++20 and CLANG_CXX_LIBRARY = libc++
 * into the Podfile's post_install block. Also merges any duplicate post_install
 * blocks into a single one to satisfy CocoaPods' single-block requirement.
 *
 * Required for react-native-safe-area-context with RN 0.81+ on Old Architecture.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CXX_PATCH = `  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
    end
  end
`;

const MARKER = '# withCxxStandard:c++20';

module.exports = function withCxxStandard(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      try {
        const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
        if (!fs.existsSync(podfilePath)) {
          console.warn('[withCxxStandard] Podfile not found, skipping.');
          return config;
        }

        let podfile = fs.readFileSync(podfilePath, 'utf8');

        // ── Step 1: Merge all post_install blocks into one ──────────────────
        // Match blocks at any indentation level. The closing `end` must be on
        // its own line at the same column as `post_install`.
        const blockRegex = /^([ \t]*)post_install do \|installer\|([\s\S]*?)^\1end[ \t]*$/gm;

        const bodies = [];
        let match;
        while ((match = blockRegex.exec(podfile)) !== null) {
          bodies.push(match[2]); // capture the body between the delimiters
        }

        if (bodies.length === 0) {
          // No post_install block at all — append a fresh one
          console.log('[withCxxStandard] No post_install block found — creating one.');
          const block = `\npost_install do |installer|\n  ${MARKER}\n${CXX_PATCH}end\n`;
          podfile = podfile.trimEnd() + '\n' + block;
          fs.writeFileSync(podfilePath, podfile);
          console.log('[withCxxStandard] Podfile patched (new block).');
          return config;
        }

        if (bodies.length > 1) {
          console.log(
            `[withCxxStandard] Found ${bodies.length} post_install blocks — merging into one.`
          );
          // Remove all existing blocks
          podfile = podfile.replace(
            /^([ \t]*)post_install do \|installer\|[\s\S]*?^\1end[ \t]*$/gm,
            ''
          );
          // Collapse leftover blank lines
          podfile = podfile.replace(/\n{3,}/g, '\n\n').trimEnd();

          // Build merged body (deduplicate the marker if already present in any body)
          const combinedBody = bodies.join('');
          const mergedBlock = `\npost_install do |installer|\n${combinedBody}\nend\n`;
          podfile = podfile + '\n' + mergedBlock;
        }

        // ── Step 2: Inject C++20 settings if not already present ────────────
        if (podfile.includes(MARKER)) {
          console.log('[withCxxStandard] C++20 patch already present, skipping injection.');
          fs.writeFileSync(podfilePath, podfile);
          return config;
        }

        // Insert immediately after the first `post_install do |installer|` line
        const postInstallLineRegex = /([ \t]*post_install do \|installer\|[ \t]*\n)/;
        if (postInstallLineRegex.test(podfile)) {
          podfile = podfile.replace(
            postInstallLineRegex,
            `$1  ${MARKER}\n${CXX_PATCH}`
          );
        }

        fs.writeFileSync(podfilePath, podfile);
        console.log('[withCxxStandard] Podfile patched with C++20 settings.');
      } catch (e) {
        console.warn('[withCxxStandard] Failed to patch Podfile:', e.message);
      }

      return config;
    },
  ]);
};
