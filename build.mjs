/**
 * Build the browser half of dsh-boot-intro.
 *
 * DSH serves a plugin's browser half as a single *classic script* at
 * /plugins/<id>/client.js, so the result must be one self-contained file with
 * no imports. We therefore concatenate:
 *
 *   1. the TokamakBoot renderer (attaches window.TokamakBoot), and
 *   2. lib/plugin-body.js (the __ModuleLoader__ registration + React overlay).
 *
 * Keeping the renderer as the single source of truth means the standalone
 * preview page and the installed plugin can never drift apart.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const renderer = readFileSync(join(here, 'tokamak-boot.js'), 'utf8');
const body = readFileSync(join(here, 'plugin', 'lib', 'plugin-body.js'), 'utf8');

const banner = `/*!
 * dsh-boot-intro — generated browser bundle. DO NOT EDIT.
 * Source: dsh-boot-animation/tokamak-boot.js + plugin/lib/plugin-body.js
 * Rebuild: node dsh-boot-animation/build.mjs
 */
`;

const out = banner + ';(() => {\n' + renderer + '\n' + body + '\n})();\n';

const dest = join(here, 'plugin', 'lib', 'client.js');
writeFileSync(dest, out, 'utf8');
console.log(`built ${dest} (${out.length} bytes)`);