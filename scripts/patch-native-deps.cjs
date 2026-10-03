/**
 * patch-native-deps.cjs — neutralise le DeprecationWarning DEP0005 `Buffer()`.
 *
 * Localisation exacte (grep élargi dist-electron/ + electron/tools/ + src/ + deps) :
 * - First-party (electron/, src/, electron/tools/) : AUCUN `new Buffer(` ni `Buffer(`
 *   direct — vérifié par le test `backupRestoreAuditRelaunch.spec.ts §3` et par grep.
 *   Rien à remplacer côté first-party (déjà Buffer.from/alloc partout).
 * - Transitif : `fd-slicer@1.1.0` (via `yauzl@2.10.0` ← `extract-zip@2.0.1` ← backup/import) :
 *   - `node_modules/fd-slicer/index.js:109` : `var buffer = new Buffer(toRead);`
 *     → chemin CHAUD (ReadStream._read, chaque entrée zip extraite) → warning persistant
 *     en Electron (le main affiche les DEP, Node 22 en CLI les déduplique/masque pour
 *     node_modules, d'où l'impression d'un warning fantôme).
 *   - `node_modules/yauzl/index.js:789-791` : fallback `return new Buffer(len);`
 *     (branche morte sur Node moderne car `Buffer.allocUnsafe` existe, patchée aussi
 *     par hygiène).
 *   - `node_modules/buffer-crc32/index.js:72,75` : fallbacks déjà gardés par
 *     `hasNewBufferAPI`, jamais exécutés — laissés intacts.
 *
 * Stratégie "pin/wrap" (pas de bump : fd-slicer est abandonné en 1.1.0, yauzl en
 * 2.10.0 ; aucun override ne fournirait un `Buffer.alloc`) : postinstall idempotent
 * qui remplace en place, avec backup `.bak` jamais écrasé. Relancé via
 * `npm run postinstall` (`electron-builder install-app-deps && node scripts/...`).
 *
 * Usage : `node scripts/patch-native-deps.cjs` (exit 0 même si node_modules absent).
 */
const fs = require('node:fs');
const path = require('node:path');

const patches = [
  {
    file: ['node_modules', 'fd-slicer', 'index.js'],
    from: 'var buffer = new Buffer(toRead);',
    to: 'var buffer = Buffer.alloc(toRead);',
    reason: 'fd-slicer@1.1.0 ReadStream._read — DEP0005 à chaque extraction zip',
  },
  {
    file: ['node_modules', 'yauzl', 'index.js'],
    from: '    return new Buffer(len);',
    to: '    return Buffer.allocUnsafe(len);',
    reason: 'yauzl@2.10.0 newBuffer fallback — DEP0005 (branche morte moderne)',
  },
];

let patched = 0;
for (const p of patches) {
  const full = path.join(process.cwd(), ...p.file);
  let src;
  try {
    src = fs.readFileSync(full, 'utf8');
  } catch {
    console.log(`[patch-native-deps] skip (absent): ${p.file.join('/')}`);
    continue;
  }
  if (!src.includes(p.from)) {
    console.log(`[patch-native-deps] déjà patché: ${p.file.join('/')}`);
    patched++;
    continue;
  }
  try {
    fs.copyFileSync(full, `${full}.bak`);
  } catch { /* best-effort */ }
  fs.writeFileSync(full, src.replace(p.from, p.to), 'utf8');
  console.log(`[patch-native-deps] patché: ${p.file.join('/')} — ${p.reason}`);
  patched++;
}
console.log(`[patch-native-deps] OK (${patched}/${patches.length} fichiers à jour).`);
