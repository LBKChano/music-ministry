import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ['app', 'components', 'contexts', 'hooks', 'lib', 'styles'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const brandedExceptions = new Map([
  ['components/CustomSplashScreen.tsx', 'Branded startup artwork and animation'],
  ['components/ErrorBoundary.tsx', 'Provider-independent emergency fallback'],
  ['lib/ui/app-theme.ts', 'Canonical semantic palette definitions'],
  ['lib/ui/splash-screen.ts', 'Native and React splash brand contract'],
]);
const colorLiteralPattern = /#[0-9a-f]{3,8}\b|rgba?\([^\n)]*\)/gi;
const forcedLightControlPatterns = [
  /themeVariant\s*=\s*["']light["']/g,
  /(?:textColor|ios_backgroundColor|thumbColor|trackColor)\s*=\s*["'](?:#[0-9a-f]{3,8}|rgba?\()/gi,
];

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return statSync(path).isFile() ? [path] : [];
  });
}

const violations = [];

for (const sourceRoot of sourceRoots) {
  const absoluteRoot = join(projectRoot, sourceRoot);
  let files = [];
  try {
    files = walk(absoluteRoot);
  } catch {
    continue;
  }

  for (const file of files) {
    const extension = file.slice(file.lastIndexOf('.'));
    if (!sourceExtensions.has(extension)) continue;
    const projectPath = relative(projectRoot, file);
    if (brandedExceptions.has(projectPath)) continue;

    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');
    for (const [index, line] of lines.entries()) {
      const literalMatches = [...line.matchAll(colorLiteralPattern)];
      for (const match of literalMatches) {
        violations.push(`${projectPath}:${index + 1} color literal ${match[0]}`);
      }
      for (const pattern of forcedLightControlPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push(`${projectPath}:${index + 1} forced light native control`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Semantic color audit failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Semantic color audit passed. ${brandedExceptions.size} documented brand/emergency exceptions.`,
);
