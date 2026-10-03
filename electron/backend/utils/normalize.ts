/**
 * normalize.ts — normalisation partagée Parent (Option B Table Parent).
 *
 * Règles (stables, utilisées par l'entité, le service ET la migration) :
 * - `normalizePhone(raw)` :
 *   trim → strip espaces/tirets/points/parenthèses → `00` → `+` →
 *   8 chiffres seuls → `+223XXXXXXXX` (Mali, sans 0 initial) →
 *   E.164 (`+` + 8..15 chiffres, 1er chiffre ≠ 0) sinon `null`.
 *   - `null` / vide / que des zéros (`000000000` import Excel) → `null`.
 *   - JAMAIS `''` en retour : soit un E.164 valide, soit `null`.
 *   - Lettres ou reste non numérique → `null` (sur-création > sur-fusion).
 * - `normalizeName(raw)` :
 *   lower → trim → collapse espaces → strip accents (NFD).
 *   Utilisé pour les clés de regroupement P2 (quadruplet père/mère).
 *
 * Contraintes métier rappelées ici (appliquées dans migration + service) :
 * - sur-création > sur-fusion en doute ;
 * - `NULL` jamais `''` pour `normalizedPhone` ;
 * - P3 (aucune clé : tél NULL + 4 noms vides) jamais fusionné ;
 * - recomposés / homonymes jamais fusionnés (clef = tél OU quadruplet exact).
 */

/** Strip les séparateurs visuels courants (espaces, tirets, points, parenthèses). */
const STRIP_RE = /[\s\-./()]/g;

/** E.164 strict : `+` suivi de 8 à 15 chiffres, premier chiffre non nul. */
const E164_RE = /^\+[1-9]\d{7,14}$/;

const ALL_ZERO_RE = /^0+$/;

/**
 * Normalise un numéro vers E.164 ou `null` si invalide / absent.
 *
 * Exemples :
 * - `" 76 12-34.56 "` → `"+22376123456"` (8 chiffres → Mali)
 * - `"0022376123456"` → `"+22376123456"` (`00` → `+`)
 * - `"+22376123456"` → inchangé (déjà E.164)
 * - `"22376123456"` (11 chiffres, indicatif sans `+`) → `"+22376123456"`
 * - `"000000000"` (faux Excel `src/components/student/student-file.vue`) → `null`
 * - `""`, `null`, `"abc"`, `"+223"` (trop court) → `null`
 */
export function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === "") return null;

  // Strip séparateurs visuels, en conservant un éventuel `+` de tête.
  const stripped = text.replace(STRIP_RE, "");
  if (stripped === "" || stripped === "+") return null;

  // `00` international → `+`.
  const plus = stripped.startsWith("00") ? `+${stripped.slice(2)}` : stripped;

  // Faux zéros Excel (que des zéros, avec ou sans `+`) → null.
  const digitsOnly = plus.startsWith("+") ? plus.slice(1) : plus;
  if (digitsOnly === "" || ALL_ZERO_RE.test(digitsOnly)) return null;

  // Déjà international : valider E.164 strict.
  if (plus.startsWith("+")) {
    // Rejeter tout reste non numérique (lettres, etc.).
    if (!/^\+[0-9]+$/.test(plus)) return null;
    return E164_RE.test(plus) ? plus : null;
  }

  // Local : que des chiffres à ce stade, sinon null.
  if (!/^[0-9]+$/.test(plus)) return null;

  // 8 chiffres seuls → Mali (+223). Sans 0 initial (format local malien).
  if (/^[0-9]{8}$/.test(plus)) return `+223${plus}`;

  // Indicatif sans `+` (ex. `22376123456`) → `+...` si E.164 valide.
  if (plus.length >= 8 && plus.length <= 15) {
    const candidate = `+${plus}`;
    return E164_RE.test(candidate) ? candidate : null;
  }

  return null;
}

/**
 * Normalise un nom pour regroupement : minuscules, trim, espaces collapsés,
 * accents stripés (NFD). `null`/vide → `""` (vide = absence de clé, pas une clé).
 *
 * Exemple : `"  Koné  TRAORÉ "` → `"kone traore"`.
 */
export function normalizeName(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Clef quadruplet P2 : les 4 noms normalisés joints par `|`.
 * Vide (`"|||"`) = absence de clé → P3 (jamais fusionné, un parent par élève).
 */
export function parentNameKey(
  fatherFirstname: unknown,
  fatherLastname: unknown,
  motherFirstname: unknown,
  motherLastname: unknown,
): string {
  return [
    normalizeName(fatherFirstname),
    normalizeName(fatherLastname),
    normalizeName(motherFirstname),
    normalizeName(motherLastname),
  ].join("|");
}

/** `true` si le quadruplet ne porte aucune clé (P3 orphelin). */
export function isNoKeyQuadruplet(key: string): boolean {
  return key === "|||";
}
