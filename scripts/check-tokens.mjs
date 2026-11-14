// Fails the build if a component hardcodes a colour or uses inline style={{…}}.
// All visual values must come from src/core/theme (design tokens).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const ALLOWED_DIR = join('src', 'core', 'theme');

// PHASE 1: code ported as-is from EventManagement. Shrink this list as each
// module is refactored onto shared/ui + tokens (phase 2). New code is never exempt.
const LEGACY_DIRS = [
  'src/components', 'src/hooks', 'src/lib', 'src/store', 'src/types',
  'src/app/select-event', 'src/app/user', 'src/app/shops', 'src/app/inventory',
  'src/app/sales', 'src/app/reports', 'src/app/shifts', 'src/app/events', 'src/app/billing',
].map((d) => join(...d.split('/')));
const isLegacy = (p) => LEGACY_DIRS.some((d) => p === d || p.startsWith(d + '/') || p.startsWith(d + '\\'));
const RULES = [
  { re: /#[0-9a-fA-F]{3,8}\b(?![^'"`]*['"`]\s*:)/, msg: 'raw hex colour' },
  { re: /\brgba?\(/, msg: 'raw rgb()/rgba() colour' },
  { re: /style=\{\{/, msg: 'inline style object' },
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!p.startsWith(ALLOWED_DIR) && !isLegacy(p)) walk(p); }
    else if (/\.(tsx?|css)$/.test(name)) files.push(p);
  }
};
walk(ROOT);

const problems = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('tokens-allow')) return;
    for (const { re, msg } of RULES) if (re.test(line)) problems.push(`${f}:${i + 1}  ${msg}: ${line.trim()}`);
  });
}
if (problems.length) {
  console.error(`✖ ${problems.length} hardcoded style value(s) — use design tokens instead:\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`✓ design-token check passed (${files.length} files; ${LEGACY_DIRS.length} legacy folders pending phase-2 refactor)`);
