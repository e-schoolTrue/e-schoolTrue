/**
 * @vitest-environment node
 *
 * GeneralInfoView onboarding « Erreur lors de la sauvegarde » :
 * le payload screenshot (CAPITAINE AISS, GIN, 2021, logo…) doit passer
 * la validation ; chaque champ invalide doit renvoyer un code + message
 * précis affiché tel quel côté UI.
 */
import { describe, it, expect } from 'vitest';
import {
  validateSchoolPayload,
  normalizeSchoolType,
  dataUrlByteSize,
  MAX_LOGO_BYTES,
} from '../schoolValidation';

const VALID = {
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

describe('validateSchoolPayload — cas screenshot onboarding', () => {
  it('payload screenshot valide → ok + normalisé', () => {
    const r = validateSchoolPayload(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalized.country).toBe('GIN');
      expect(r.normalized.type).toBe('privée');
      expect(r.normalized.foundationYear).toBe(2021);
    }
  });

  it('variante « Privé » (label masculin screenshot) → normalisée en « privée »', () => {
    expect(normalizeSchoolType('Privé')).toBe('privée');
    expect(normalizeSchoolType('prive')).toBe('privée');
    expect(normalizeSchoolType('public')).toBe('publique');
    const r = validateSchoolPayload({ ...VALID, type: 'Privé' });
    expect(r.ok).toBe(true);
  });

  it('type manquant (formData sans init) → TYPE_INVALIDE explicite', () => {
    const r = validateSchoolPayload({ ...VALID, type: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('TYPE_INVALIDE');
      expect(r.message).toMatch(/Public.*Privé|Privé.*Public/);
    }
  });

  it.each([
    [{ ...VALID, name: '  ' }, 'NOM_REQUIS'],
    [{ ...VALID, address: '' }, 'ADRESSE_REQUISE'],
    [{ ...VALID, town: '' }, 'VILLE_REQUISE'],
    [{ ...VALID, country: 'XX' }, 'PAYS_INVALIDE'],
    [{ ...VALID, country: 'GNF' }, 'PAYS_INVALIDE'],
    [{ ...VALID, foundationYear: 1700 }, 'ANNEE_FONDATION_INVALIDE'],
    [{ ...VALID, email: 'casy2021' }, 'EMAIL_INVALIDE'],
    [{ ...VALID, phone: 'abc!!!' }, 'TELEPHONE_INVALIDE'],
    [{ ...VALID, logo: { content: 'not-a-data-url', name: 'x.png', type: 'image/png' } }, 'LOGO_TYPE_INVALIDE'],
    [{ ...VALID, logo: { content: 'data:text/plain;base64,abcd', name: 'x.txt', type: 'text/plain' } }, 'LOGO_TYPE_INVALIDE'],
  ])('payload invalide → code précis (%s)', (payload: any, code: string) => {
    const r = validateSchoolPayload(payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(code);
  });

  it('logo > 2 Mo → LOGO_TROP_VOLUMINEUX avec taille', () => {
    const bigB64 = Buffer.alloc(MAX_LOGO_BYTES + 100).toString('base64');
    const r = validateSchoolPayload({
      ...VALID,
      logo: { content: `data:image/png;base64,${bigB64}`, name: 'big.png', type: 'image/png' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('LOGO_TROP_VOLUMINEUX');
      expect(r.message).toMatch(/2 Mo/);
    }
  });

  it('mini PNG valide → taille décodée > 0 et ≤ limite', () => {
    const size = dataUrlByteSize(tinyPng);
    expect(size).not.toBeNull();
    expect(size!).toBeGreaterThan(0);
    expect(size!).toBeLessThanOrEqual(MAX_LOGO_BYTES);
    expect(validateSchoolPayload({ ...VALID, logo: { content: tinyPng, name: 'logo.png', type: 'image/png' } }).ok).toBe(true);
  });

  it('email/téléphone vides → tolérés (champs optionnels)', () => {
    expect(validateSchoolPayload({ ...VALID, email: '', phone: '' }).ok).toBe(true);
  });
});
