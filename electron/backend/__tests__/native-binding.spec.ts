import { describe, it, expect } from "vitest";
import {
  isValidNativeBinary,
  expectedBinaryLabel,
  toLoadableNativePath,
} from "../lib/native-binding";

/**
 * Garde pilote natif platform-aware.
 * Non-régression : exiger ELF partout bloquait les postes Windows
 * (binaire PE légitime rejeté → "Échec du Démarrage" après update).
 */
describe("native-binding : validation platform-aware", () => {
  const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
  const PE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
  const MACHO64 = Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0x00]);
  const MACHO_FAT = Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00]);
  const GARBAGE = Buffer.from([0x00, 0x01, 0x02, 0x03]);

  it("linux accepte ELF, refuse PE et garbage", () => {
    expect(isValidNativeBinary(ELF, "linux")).toBe(true);
    expect(isValidNativeBinary(PE, "linux")).toBe(false);
    expect(isValidNativeBinary(GARBAGE, "linux")).toBe(false);
  });

  it("win32 accepte PE (le cas du bug : postes bloqués après update)", () => {
    expect(isValidNativeBinary(PE, "win32")).toBe(true);
    expect(isValidNativeBinary(ELF, "win32")).toBe(false);
    expect(isValidNativeBinary(GARBAGE, "win32")).toBe(false);
  });

  it("darwin accepte Mach-O thin et fat, refuse PE/ELF", () => {
    expect(isValidNativeBinary(MACHO64, "darwin")).toBe(true);
    expect(isValidNativeBinary(MACHO_FAT, "darwin")).toBe(true);
    expect(isValidNativeBinary(PE, "darwin")).toBe(false);
    expect(isValidNativeBinary(ELF, "darwin")).toBe(false);
    expect(isValidNativeBinary(GARBAGE, "darwin")).toBe(false);
  });

  it("buffer < 4 octets toujours rejeté", () => {
    for (const p of ["linux", "win32", "darwin"]) {
      expect(isValidNativeBinary(Buffer.alloc(0), p)).toBe(false);
      expect(isValidNativeBinary(Buffer.from([0x4d, 0x5a]), p)).toBe(false);
    }
  });

  it("libellés actionnables par plateforme", () => {
    expect(expectedBinaryLabel("win32")).toContain("Windows");
    expect(expectedBinaryLabel("darwin")).toContain("macOS");
    expect(expectedBinaryLabel("linux")).toContain("Linux");
  });

  it("toLoadableNativePath mappe asar → asar.unpacked (ce que dlopen charge)", () => {
    expect(toLoadableNativePath(
      "C:/App/resources/app.asar/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    )).toBe(
      "C:/App/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    );
    expect(toLoadableNativePath(
      "/opt/Eschool/resources/app.asar/dist-electron/main.js"
    )).toBe("/opt/Eschool/resources/app.asar.unpacked/dist-electron/main.js");
    // Déjà dépaqueté ou hors asar : inchangé.
    expect(toLoadableNativePath(
      "C:/App/resources/app.asar.unpacked/node_modules/x.node"
    )).toBe("C:/App/resources/app.asar.unpacked/node_modules/x.node");
    expect(toLoadableNativePath("/home/oumar/node_modules/x.node")).toBe(
      "/home/oumar/node_modules/x.node"
    );
  });

  it("le binaire win-unpacked livré est reconnu valide pour win32", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const p = path.join(
      __dirname, "..", "..", "..",
      "release", "1.1.21", "win-unpacked", "resources", "app.asar.unpacked",
      "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node"
    );
    if (!fs.existsSync(p)) return; // release non packagée en CI : skip doux
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    expect(isValidNativeBinary(buf, "win32")).toBe(true);
    expect(isValidNativeBinary(buf, "linux")).toBe(false);
  });
});
