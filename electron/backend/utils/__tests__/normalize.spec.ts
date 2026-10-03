import { describe, expect, it } from "vitest";
import { isNoKeyQuadruplet, normalizeName, normalizePhone, parentNameKey } from "../normalize";

/**
 * Option B Table Parent — normalisation partagée.
 * Invariants : E.164 ou `null` (JAMAIS `''`), faux Excel → `null`.
 */
describe("normalizePhone", () => {
  it("8 chiffres seuls → +223 (Mali)", () => {
    expect(normalizePhone("76 12-34.56")).toBe("+22376123456");
    expect(normalizePhone("(76)12.34.56")).toBe("+22376123456");
  });
  it("00 → +", () => {
    expect(normalizePhone("0022376123456")).toBe("+22376123456");
  });
  it("E.164 déjà valide inchangé", () => {
    expect(normalizePhone("+22376123456")).toBe("+22376123456");
  });
  it("indicatif sans + → +", () => {
    expect(normalizePhone("22376123456")).toBe("+22376123456");
  });
  it("faux Excel / vide / invalide → null (jamais '')", () => {
    expect(normalizePhone("000000000")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+223")).toBeNull(); // trop court
    expect(normalizePhone("+223 76AB1256")).toBeNull(); // lettres
  });
});

describe("normalizeName / parentNameKey", () => {
  it("lower + trim + collapse + strip accents", () => {
    expect(normalizeName("  Koné  TRAORÉ ")).toBe("kone traore");
    expect(normalizeName(null)).toBe("");
  });
  it("quadruplet vide = P3 (jamais fusionné)", () => {
    expect(parentNameKey("", "", "", "")).toBe("|||");
    expect(isNoKeyQuadruplet(parentNameKey(null, null, null, null))).toBe(true);
    expect(isNoKeyQuadruplet(parentNameKey("Moussa", "Diallo", "Aminata", "Bah"))).toBe(false);
  });
  it("insensible casse/accents (P2 regroupe Koné/KONE)", () => {
    expect(parentNameKey("SEKOU", "kone", "DJENEBA", "TRAORE")).toBe(
      parentNameKey("Sekou", "Koné", "Djeneba", "Traoré"),
    );
  });
});
