/**
 * withMergePostInstall.js
 *
 * Merges all duplicate `post_install do |installer|` blocks in the generated
 * Podfile into a single one. Must be listed LAST in app.json plugins so it
 * runs after every other plugin has had a chance to append its own block.
 *
 * This fixes:
 *   "Invalid `Podfile` file: [!] Specifying multiple `post_install` hooks is unsupported."
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withMergePostInstall(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      try {
        const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
        if (!fs.existsSync(podfilePath)) return config;

        let podfile = fs.readFileSync(podfilePath, 'utf8');

        // Collect all post_install blocks.
        // Each block starts with `post_install do |installer|` and ends with
        // the matching `end` at the same indentation level (column 0).
        const blockRegex = /^post_install do \|installer\|([\s\S]*?)^end$/gm;

        const bodies = [];
        let match;
        while ((match = blockRegex.exec(podfile)) !== null) {
          bodies.push(match[1]);
        }

        if (bodies.length <= 1) {
          // Nothing to merge
          return config;
        }

        console.log(
          `[withMergePostInstall] Found ${bodies.length} post_install blocks — merging into one.`
        );

        // Remove ALL existing post_install blocks from the file
        podfile = podfile.replace(/^post_install do \|installer\|[\s\S]*?^end$/gm, '');

        // Collapse any runs of 3+ blank lines left behind by the removals
        podfile = podfile.replace(/\n{3,}/g, '\n\n');

        // Build the merged block
        const mergedBody = bodies.join('');
        const mergedBlock = `post_install do |installer|\n${mergedBody}\nend\n`;

        podfile = podfile.trimEnd() + '\n\n' + mergedBlock;

        fs.writeFileSync(podfilePath, podfile);
        console.log('[withMergePostInstall] Podfile post_install blocks merged successfully.');
      } catch (e) {
        console.warn('[withMergePostInstall] Failed to merge post_install blocks:', e.message);
      }
      return config;
    },
  ]);
};
