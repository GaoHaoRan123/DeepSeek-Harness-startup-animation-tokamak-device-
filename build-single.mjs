/**
 * Builds a single self-contained HTML file from boot-animation.html.
 *
 * The output has no external dependencies at all: open it by double-clicking,
 * no server, no network, no build step needed by the person downloading it.
 *
 * Run: node build-single.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'boot-animation.html'), 'utf8');
const js = readFileSync(join(here, 'tokamak-boot.js'), 'utf8');

const tag = '<script src="tokamak-boot.js"></script>';
if (!html.includes(tag)) {
  console.error(`could not find ${tag} in boot-animation.html`);
  process.exit(1);
}

// A literal </script> inside an inline script would end the block early.
const safe = js.replace(/<\/script/gi, '<\\/script');

const out = html.replace(tag, `<script>\n${safe}\n</script>`);

const distDir = join(here, 'dist');
mkdirSync(distDir, { recursive: true });
const dest = join(distDir, 'dsh-boot-intro.html');
writeFileSync(dest, out, 'utf8');

console.log(`built ${dest} (${out.length} bytes, self-contained)`);