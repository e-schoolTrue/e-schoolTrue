/**
 * Validation pure du payload `school:save` (GeneralInfoView onboarding + SchoolInfoView).
 * Zéro dépendance Electron/TypeORM → testable en vitest node sans mock.
 *
 * Codes d'erreur stables (affichés tels quels côté UI) :
 * NOM_REQUIS, ADRESSE_REQUISE, VILLE_REQUISE, TYPE_INVALIDE, PAYS_INVALIDE,
 * ANNEE_FONDATION_INVALIDE, EMAIL_INVALIDE, TELEPHONE_INVALIDE,
 * LOGO_TYPE_INVALIDE, LOGO_CORROMPU, LOGO_TROP_VOLUMINEUX.
 */
export type SchoolType = 'publique' | 'privée';

export interface SchoolLogoInput {
  content: string;
  name: string;
  type: string;
}

export interface SchoolPayloadInput {
  name?: unknown;
  address?: unknown;
  town?: unknown;
  country?: unknown;
  phone?: unknown;
  email?: unknown;
  type?: unknown;
  foundationYear?: unknown;
  logo?: SchoolLogoInput | null | undefined;
}

export interface SchoolValidationOk {
  ok: true;
  normalized: {
    name: string;
    address: string;
    town: string;
    country: string;
    phone: string;
    email: string;
    type: SchoolType;
    foundationYear: number;
  };
}

export interface SchoolValidationKo {
  ok: false;
  code: string;
  message: string;
}

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9][0-9 .\-()/]{3,19}$/;
const ALLOWED_COUNTRIES = ['MAR', 'SEN', 'CAF', 'GIN'] as const;

/** Normalise les variantes saisies ("Privé", "prive", "public"…) vers le type canonique. */
export function normalizeSchoolType(v: unknown): SchoolType | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s === 'publique' || s === 'public') return 'publique';
  if (s === 'privee' || s === 'prive' || s === 'private') return 'privée';
  return null;
}

function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function dataUrlByteSize(dataUrl: string): number | null {
  const m = /^data:.*?;base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const b64 = m[1].replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return null;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function validateSchoolPayload(input: SchoolPayloadInput): SchoolValidationOk | SchoolValidationKo {
  const name = asTrimmed(input.name);
  if (!name) {
    return { ok: false, code: 'NOM_REQUIS', message: "Le nom de l'établissement est requis." };
  }
  const address = asTrimmed(input.address);
  if (!address) {
    return { ok: false, code: 'ADRESSE_REQUISE', message: "L'adresse de l'établissement est requise." };
  }
  const town = asTrimmed(input.town);
  if (!town) {
    return { ok: false, code: 'VILLE_REQUISE', message: 'La ville est requise.' };
  }
  const country = asTrimmed(input.country);
  if (!(ALLOWED_COUNTRIES as readonly string[]).includes(country)) {
    return {
      ok: false,
      code: 'PAYS_INVALIDE',
      message: 'Pays invalide : choisissez Maroc (MAR), Sénégal (SEN), Centrafrique (CAF) ou Guinée (GIN).',
    };
  }
  const type = normalizeSchoolType(input.type);
  if (!type) {
    return {
      ok: false,
      code: 'TYPE_INVALIDE',
      message: "Type d'établissement invalide : choisissez « Public » ou « Privé ».",
    };
  }
  const year = Number(input.foundationYear);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1800 || year > currentYear + 1) {
    return {
      ok: false,
      code: 'ANNEE_FONDATION_INVALIDE',
      message: `Année de fondation invalide : attendue entre 1800 et ${currentYear + 1}.`,
    };
  }
  const email = asTrimmed(input.email);
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, code: 'EMAIL_INVALIDE', message: `Adresse e-mail invalide : « ${email} ».` };
  }
  const phone = asTrimmed(input.phone);
  if (phone && !PHONE_RE.test(phone)) {
    return {
      ok: false,
      code: 'TELEPHONE_INVALIDE',
      message: `Numéro de téléphone invalide : « ${phone} » (chiffres, espaces, +, -, /, parenthèses).`,
    };
  }
  const logo = input.logo;
  if (logo !== undefined && logo !== null) {
    if (typeof logo.content !== 'string' || !logo.content.startsWith('data:image/')) {
      return {
        ok: false,
        code: 'LOGO_TYPE_INVALIDE',
        message: 'Logo invalide : sélectionnez un fichier image (JPG, PNG, GIF).',
      };
    }
    if (typeof logo.type === 'string' && logo.type && !logo.type.startsWith('image/')) {
      return {
        ok: false,
        code: 'LOGO_TYPE_INVALIDE',
        message: `Logo invalide : type « ${logo.type} » non pris en charge (image attendue).`,
      };
    }
    const size = dataUrlByteSize(logo.content);
    if (size === null) {
      return { ok: false, code: 'LOGO_CORROMPU', message: 'Logo illisible : le contenu base64 est corrompu. Réessayez.' };
    }
    if (size > MAX_LOGO_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1);
      return {
        ok: false,
        code: 'LOGO_TROP_VOLUMINEUX',
        message: `Logo trop volumineux (${mb} Mo) : limite de 2 Mo. Compressez l'image.`,
      };
    }
  }
  return { ok: true, normalized: { name, address, town, country, phone, email, type, foundationYear: year } };
}
