/**
 * @vitest-environment node
 * QA extrême — validation school : chaque code isolé + frontières logo + variantes type + bypass.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateSchoolPayload,
  normalizeSchoolType,
  dataUrlByteSize,
  MAX_LOGO_BYTES,
} from '../schoolValidation';

const VALID: any = {
  name: 'COMPLEXE SCOLAIRE CAPITAINE AISS',
  address: 'KOUNTIAH USINE MATHELAS',
  town: 'CONAKRY',
  country: 'GIN',
  phone: '625123456',
  email: 'casy2021@gmail.com',
  type: 'privée',
  foundationYear: 2021,
};

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('schoolValidationExtended — chaque code isolé', () => {
  it('NOM_REQUIS : vide / espaces / non-string', () => {
    for (const name of ['', '   ', undefined, null, 123]) {
      const r = validateSchoolPayload({ ...VALID, name });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('NOM_REQUIS');
    }
  });
  it('ADRESSE_REQUISE', () => {
    for (const address of ['', '  ', undefined]) {
      const r = validateSchoolPayload({ ...VALID, address });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('ADRESSE_REQUISE');
    }
  });
  it('VILLE_REQUISE', () => {
    const r = validateSchoolPayload({ ...VALID, town: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VILLE_REQUISE');
  });
  it('TYPE_INVALIDE : chaque variante rejetée / acceptée', () => {
    for (const bad of [undefined, '', 'unknown', 'étatique', 42, null]) {
      const r = validateSchoolPayload({ ...VALID, type: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('TYPE_INVALIDE');
    }
    expect(normalizeSchoolType('Privé')).toBe('privée');
    expect(normalizeSchoolType('PRIVE')).toBe('privée');
    expect(normalizeSchoolType('prive')).toBe('privée');
    expect(normalizeSchoolType('private')).toBe('privée');
    expect(normalizeSchoolType('  Public  ')).toBe('publique');
    expect(normalizeSchoolType('PUBLIQUE')).toBe('publique');
    expect(validateSchoolPayload({ ...VALID, type: 'Privé' }).ok).toBe(true);
  });
  it('PAYS_INVALIDE : XX / GNF / minuscule / vide', () => {
    for (const country of ['XX', 'GNF', 'gin', '', 'FR', undefined]) {
      const r = validateSchoolPayload({ ...VALID, country });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('PAYS_INVALIDE');
    }
    for (const ok of ['MAR', 'SEN', 'CAF', 'GIN']) {
      expect(validateSchoolPayload({ ...VALID, country: ok }).ok).toBe(true);
    }
  });
  it('ANNEE_FONDATION_INVALIDE : 1700 / futur+2 / NaN / string', () => {
    const future = new Date().getFullYear() + 2;
    for (const foundationYear of [1700, 1799, future, NaN, 'abc', '', undefined, 2021.5]) {
      const r = validateSchoolPayload({ ...VALID, foundationYear });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('ANNEE_FONDATION_INVALIDE');
    }
    expect(validateSchoolPayload({ ...VALID, foundationYear: 1800 }).ok).toBe(true);
    expect(validateSchoolPayload({ ...VALID, foundationYear: new Date().getFullYear() + 1 }).ok).toBe(true);
  });
  it('EMAIL_INVALIDE : sans @ / sans domaine', () => {
    for (const email of ['casy2021', 'a@b', 'a@b.c', 'x y@z.com']) {
      const r = validateSchoolPayload({ ...VALID, email });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('EMAIL_INVALIDE');
    }
    expect(validateSchoolPayload({ ...VALID, email: '' }).ok).toBe(true);
  });
  it('TELEPHONE_INVALIDE : lettres / symboles', () => {
    for (const phone of ['abc!!!', '!!', '12']) {
      const r = validateSchoolPayload({ ...VALID, phone });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('TELEPHONE_INVALIDE');
    }
    expect(validateSchoolPayload({ ...VALID, phone: '' }).ok).toBe(true);
    expect(validateSchoolPayload({ ...VALID, phone: '+224 625 12 34 56' }).ok).toBe(true);
  });
  it('LOGO_TYPE_INVALIDE : non-data-url / text/plain', () => {
    const a = validateSchoolPayload({ ...VALID, logo: { content: 'not-a-data-url', name: 'x.png', type: 'image/png' } });
    expect(!a.ok && !a.ok && (a as any).code).toBe('LOGO_TYPE_INVALIDE');
    const b = validateSchoolPayload({ ...VALID, logo: { content: 'data:text/plain;base64,abcd', name: 'x.txt', type: 'text/plain' } });
    expect(!b.ok && (b as any).code).toBe('LOGO_TYPE_INVALIDE');
  });
  it('LOGO_CORROMPU : base64 invalide / padding cassé / vide', () => {
    const bad1 = validateSchoolPayload({ ...VALID, logo: { content: 'data:image/png;base64,!!!@@@', name: 'x.png', type: 'image/png' } });
    expect(!bad1.ok && (bad1 as any).code).toBe('LOGO_CORROMPU');
    const bad2 = validateSchoolPayload({ ...VALID, logo: { content: 'data:image/png;base64,abc', name: 'x.png', type: 'image/png' } });
    expect(!bad2.ok && (bad2 as any).code).toBe('LOGO_CORROMPU');
    expect(dataUrlByteSize('not-a-data-url')).toBeNull();
    expect(dataUrlByteSize('data:image/png;base64,abc')).toBeNull();
  });
  it('LOGO frontières : exactement 2Mo OK, +1 octet KO', () => {
    const exact = Buffer.alloc(MAX_LOGO_BYTES).toString('base64');
    expect(validateSchoolPayload({ ...VALID, logo: { content: `data:image/png;base64,${exact}`, name: 'ok.png', type: 'image/png' } }).ok).toBe(true);
    const over = Buffer.alloc(MAX_LOGO_BYTES + 1).toString('base64');
    const r = validateSchoolPayload({ ...VALID, logo: { content: `data:image/png;base64,${over}`, name: 'ko.png', type: 'image/png' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('LOGO_TROP_VOLUMINEUX');
      expect(r.message).toMatch(/2 Mo/);
    }
  });
  it('logo absent/null → toléré ; mini PNG OK', () => {
    expect(validateSchoolPayload({ ...VALID, logo: undefined }).ok).toBe(true);
    expect(validateSchoolPayload({ ...VALID, logo: null }).ok).toBe(true);
    expect(validateSchoolPayload({ ...VALID, logo: { content: tinyPng, name: 'logo.png', type: 'image/png' } }).ok).toBe(true);
  });
  it('onboarding bypass : school:save + saveSettings allowDuringFirstLaunch', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'electron', 'events.ts'), 'utf-8');
    for (const ch of ['school:save', 'school:saveSettings']) {
      const idx = src.indexOf(`protectedHandle("${ch}"`);
      expect(idx).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 800)).toMatch(/allowDuringFirstLaunch:\s*true/);
    }
  });
});
