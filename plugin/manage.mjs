/**
 * Install / uninstall the dsh-boot-intro plugin into a DSH profile.
 *
 * Why this is update-proof: the plugin is installed into the *profile*
 * directory (default ~/.dsh/profiles/desktop), never into the application.
 * The Windows installer replaces D:\deepseekAPP (exe, resources/app.asar,
 * runtime) on every update, but it does not touch ~/.dsh, so this plugin and
 * its registration survive updates untouched.
 *
 * Usage:
 *   node manage.mjs install     copy the plugin in and register the bundle
 *   node manage.mjs uninstall   remove the bundle entry and the plugin folder
 *   node manage.mjs status      report current state (changes nothing)
 *
 * Set DSH_PROFILE_DIR to target a different profile.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh', 'profiles', 'desktop');
const PLUGIN_ID = 'dsh-boot-intro';
const DEST = join(PROFILE, 'node_modules', PLUGIN_ID);
const PROFILE_PKG = join(PROFILE, 'package.json');

const FILES = [
  'package.json',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/client.js'
];

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function bundledIds(pkg) {
  return (pkg.dsh && pkg.dsh.profile && Array.isArray(pkg.dsh.profile.bundles))
    ? pkg.dsh.profile.bundles
    : [];
}

function status() {
  const installed = existsSync(join(DEST, 'lib', 'client.js'));
  let registered = false;
  let profileExists = existsSync(PROFILE_PKG);
  if (profileExists) registered = bundledIds(readJson(PROFILE_PKG)).includes(PLUGIN_ID);
  return { profileExists, installed, registered };
}

function install() {
  if (!existsSync(PROFILE_PKG)) {
    console.error(`profile package.json not found: ${PROFILE_PKG}`);
    console.error('Is DeepSeek Harness installed and has it been launched at least once?');
    process.exitCode = 1;
    return;
  }

  // 1. Back up the profile manifest before changing it.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${PROFILE_PKG}.backup-${stamp}`;
  copyFileSync(PROFILE_PKG, backup);

  // 2. Copy the plugin files in.
  for (const rel of FILES) {
    const src = join(here, rel);
    if (!existsSync(src)) {
      console.error(`missing build artifact: ${src}\nRun: node dsh-boot-animation/build.mjs`);
      process.exitCode = 1;
      return;
    }
    const dst = join(DEST, rel);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }

  // 3. Register the bundle (idempotent).
  const pkg = readJson(PROFILE_PKG);
  pkg.dsh = pkg.dsh || {};
  pkg.dsh.profile = pkg.dsh.profile || {};
  pkg.dsh.profile.bundles = pkg.dsh.profile.bundles || [];
  const added = !pkg.dsh.profile.bundles.includes(PLUGIN_ID);
  if (added) {
    pkg.dsh.profile.bundles.push(PLUGIN_ID);
    writeJson(PROFILE_PKG, pkg);
  }

  console.log('dsh-boot-intro installed');
  console.log(`  profile      ${PROFILE}`);
  console.log(`  plugin       ${DEST}`);
  console.log(`  files        ${FILES.length} copied (${FILES.join(', ')})`);
  console.log(`  bundle entry ${added ? 'added' : 'already present'}`);
  console.log(`  backup       ${backup}`);
  console.log('');
  console.log('Restart DeepSeek Harness to load the animation.');
  console.log(`Undo: node "${join(here, 'manage.mjs')}" uninstall`);
}

function uninstall() {
  const pkgExisted = existsSync(PROFILE_PKG);
  let removedEntry = false;
  if (pkgExisted) {
    const pkg = readJson(PROFILE_PKG);
    const ids = bundledIds(pkg);
    if (ids.includes(PLUGIN_ID)) {
      pkg.dsh.profile.bundles = ids.filter(id => id !== PLUGIN_ID);
      writeJson(PROFILE_PKG, pkg);
      removedEntry = true;
    }
  }
  const hadDir = existsSync(DEST);
  if (hadDir) rmSync(DEST, { recursive: true, force: true });

  console.log('dsh-boot-intro uninstalled');
  console.log(`  bundle entry ${removedEntry ? 'removed' : 'was not present'}`);
  console.log(`  plugin dir   ${hadDir ? 'removed' : 'was not present'}`);
  console.log('Restart DeepSeek Harness to return to the stock startup.');
}

const action = process.argv[2] || 'status';
if (action === 'install') {
  install();
} else if (action === 'uninstall') {
  uninstall();
} else if (action === 'status') {
  const s = status();
  console.log('dsh-boot-intro status');
  console.log(`  profile dir exists     ${s.profileExists}  (${PROFILE})`);
  console.log(`  plugin files installed ${s.installed}`);
  console.log(`  registered as bundle   ${s.registered}`);
  const size = s.installed && existsSync(join(DEST, 'lib', 'client.js'))
    ? statSync(join(DEST, 'lib', 'client.js')).size : 0;
  if (size) console.log(`  client.js size         ${size} bytes`);
} else {
  console.error(`unknown action: ${action}\nUse: install | uninstall | status`);
  process.exitCode = 1;
}