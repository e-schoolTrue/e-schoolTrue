/**
 * Garde pilote natif (better-sqlite3) — validation platform-aware.
 *
 * Contexte : le binaire natif a déjà été retrouvé remplacé par un build
 * d'une autre plateforme (ex. DLL Windows sur un poste Linux →
 * "invalid ELF header"), ce qui faisait échouer TypeORM avec une erreur
 * cryptique. Pire : un contrôle "ELF uniquement" bloque TOUS les postes
 * Windows (binaire PE légitime). D'où validation selon process.platform.
 *
 * Fonctions pures testables (aucune dépendance Electron).
 */

export type NativePlatform = "win32" | "darwin" | "linux" | string;

/** Magies Mach-O (32/64-bit, little/big-endian, fat binary). */
const MACHO_MAGICS = new Set([
  0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca,
]);

/**
 * Vérifie l'en-tête d'un binaire natif Node (.node) pour la plateforme donnée.
 * - win32  : en-tête MZ (PE32/PE32+)
 * - darwin : magie Mach-O (thin 32/64 LE/BE ou fat)
 * - autres (linux, …) : magie ELF (0x7F 'E' 'L' 'F')
 * Buffer < 4 octets → false.
 */
export function isValidNativeBinary(
  header: Uint8Array | Buffer,
  platform: NativePlatform = process.platform
): boolean {
  if (!header || header.length < 4) return false;
  if (platform === "win32") {
    return header[0] === 0x4d && header[1] === 0x5a;
  }
  if (platform === "darwin") {
    const magic =
      (header[0] << 24) | (header[1] << 16) | (header[2] << 8) | header[3];
    return MACHO_MAGICS.has(magic >>> 0) || MACHO_MAGICS.has(magic);
  }
  return (
    header[0] === 0x7f &&
    header[1] === 0x45 &&
    header[2] === 0x4c &&
    header[3] === 0x46
  );
}

/** Libellé du binaire attendu, pour messages d'erreur compréhensibles. */
export function expectedBinaryLabel(
  platform: NativePlatform = process.platform
): string {
  if (platform === "win32") return "binaire Windows (PE)";
  if (platform === "darwin") return "binaire macOS (Mach-O)";
  return "binaire Linux (ELF)";
}

/**
 * Chemin réellement chargé par dlopen pour un natif résolu via require.
 * En packagé, require.resolve pointe DANS app.asar, mais Electron charge
 * la copie dépaquetée (app.asar.unpacked). Un binaire valide lu dans
 * l'asar mais absent de .unpacked planterait au chargement : c'est donc
 * le chemin .unpacked qu'il faut contrôler.
 */
export function toLoadableNativePath(resolvedPath: string): string {
  const m = /^(.*\.asar)(?!\.unpacked)([/\\].*)?$/.exec(resolvedPath);
  return m ? `${m[1]}.unpacked${m[2] ?? ""}` : resolvedPath;
}

/** Lit les 4 premiers octets d'un fichier, null si illisible. */
export function readBinaryHeader(
  filePath: string,
  fs: { openSync(p: string, m: string): number; readSync(f: number, b: Buffer, o: number, l: number, p: number | null): number; closeSync(f: number): void }
): Buffer | null {
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(4);
      const n = fs.readSync(fd, buf, 0, 4, 0);
      return n >= 4 ? buf : null;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}
