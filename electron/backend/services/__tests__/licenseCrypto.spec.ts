// =============================================================================
// Tests unitaires du module crypto des licences (licenseCrypto.ts)
// =============================================================================
// Le module est « pur » (aucun import electron) : il est testé avec de vraies
// clés Ed25519. `verifyMaster` accepte une clé publique de test pour pouvoir
// vérifier des jetons signés avec une paire de clés générée dans le test.

import { describe, it, expect } from 'vitest'
import {
    PRODUCT_ID,
    LICENSE_VERSION,
    generateKeyPair,
    encodeToken,
    verifyMaster,
    signMaster,
    signSub,
    verifySub,
    deriveSubPublicKey,
    buildMachineFingerprint,
    isExpired,
    daysRemaining,
} from '../licenseCrypto'
import type { MasterLicensePayload, SubLicensePayload } from '../licenseCrypto'

// vite-plugin-electron-renderer remplace 'node:os' par un wrapper CJS qui casse
// en environnement jsdom (comme 'path' pour env.spec.ts) : on le mocke avec des
// valeurs déterministes pour buildMachineFingerprint.
vi.mock('node:os', () => ({
    cpus: () => [{ model: 'test-cpu-model' }],
    hostname: () => 'test-host',
    platform: () => 'linux',
    arch: () => 'x64',
    totalmem: () => 8 * 1073741824,
}))

const DAY_MS = 86_400_000;

/** Payload maître valide, surchargeable pour les cas négatifs. */
function validMasterPayload(overrides: Partial<MasterLicensePayload> = {}): MasterLicensePayload {
    return {
        v: LICENSE_VERSION,
        kid: PRODUCT_ID,
        lid: 'MST-TEST-0001',
        cust: 'École Test',
        type: 'master',
        maxStations: 5,
        seed: 'a'.repeat(64),
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Payload sous-licence valide, surchargeable pour les cas négatifs. */
function validSubPayload(overrides: Partial<SubLicensePayload> = {}): SubLicensePayload {
    return {
        v: LICENSE_VERSION,
        kid: PRODUCT_ID,
        lid: 'SUB-TEST-0001',
        type: 'sub',
        masterLid: 'MST-TEST-0001',
        machineId: 'machine-B',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2029-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('Licence maître (signature Ed25519 réelle)', () => {
    it('round-trip : signMaster → verifyMaster retourne le payload et ajoute v/kid', () => {
        const { privateKeyHex, publicKeyHex } = generateKeyPair();
        const payload = validMasterPayload();

        const token = signMaster(payload, privateKeyHex);
        const parsed = verifyMaster(token, publicKeyHex);

        expect(parsed).toMatchObject({
            lid: payload.lid,
            cust: payload.cust,
            maxStations: payload.maxStations,
            seed: payload.seed,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
            v: LICENSE_VERSION,
            kid: PRODUCT_ID,
            type: 'master',
        });
        // Le jeton a bien la forme "payload.signature"
        expect(token.split('.')).toHaveLength(2);
    });

    it('rejette un jeton signé avec une autre clé publique', () => {
        const { privateKeyHex } = generateKeyPair();
        const otherKeyPair = generateKeyPair();
        const token = signMaster(validMasterPayload(), privateKeyHex);

        expect(() => verifyMaster(token, otherKeyPair.publicKeyHex)).toThrow('Signature invalide');
    });

    it('rejette un jeton falsifié (1 caractère modifié)', () => {
        const { privateKeyHex, publicKeyHex } = generateKeyPair();
        const token = signMaster(validMasterPayload(), privateKeyHex);

        // Modifie le dernier caractère de la signature hexadécimale
        const last = token.charAt(token.length - 1);
        const flipped = last === 'a' ? 'b' : 'a';
        const tampered = `${token.slice(0, -1)}${flipped}`;

        expect(tampered).not.toBe(token);
        expect(() => verifyMaster(tampered, publicKeyHex)).toThrow('Signature invalide');
    });

    it('rejette un payload avec une version non prise en charge (message dédié)', () => {
        const { publicKeyHex } = generateKeyPair();
        const badPayload = validMasterPayload({ v: 99 });
        const token = encodeToken(badPayload, '00'.repeat(64));

        expect(() => verifyMaster(token, publicKeyHex)).toThrow(/version 99 non prise en charge/);
    });

    it('rejette un payload avec un identifiant produit inconnu (message dédié)', () => {
        const { publicKeyHex } = generateKeyPair();
        const badPayload = validMasterPayload({ kid: 'AUTRE-PRODUIT' });
        const token = encodeToken(badPayload, '00'.repeat(64));

        expect(() => verifyMaster(token, publicKeyHex)).toThrow(/produit 'AUTRE-PRODUIT' inconnu/);
    });

    it('rejette un jeton vide', () => {
        expect(() => verifyMaster('')).toThrow(/jeton vide ou manquant/);
    });

    it('rejette un jeton sans séparateur point', () => {
        expect(() => verifyMaster('abc')).toThrow(/format attendu/);
        expect(() => verifyMaster('.abc')).toThrow(/format attendu/);
    });

    it('rejette un payload base64 invalide', () => {
        // atob est permissif dans certains environnements (jsdom) : le payload
        // décodé est alors du binaire corrompu, rejeté par le parseur JSON.
        expect(() => verifyMaster('!!not-base64!!.abcd')).toThrow(/mal encodé|corrompu/);
    });

    it('rejette une signature mal formée', () => {
        const { publicKeyHex } = generateKeyPair();
        const token = encodeToken(validMasterPayload(), 'aabb'); // 2 octets au lieu de 64

        expect(() => verifyMaster(token, publicKeyHex)).toThrow(/signature mal formée/);
    });
});

describe('Sous-licence (clé dérivée du seed maître)', () => {
    const masterSeed = 'c'.repeat(64);

    it('round-trip : signSub → verifySub retourne le payload pour la bonne machine', () => {
        const payload = validSubPayload();

        const token = signSub(payload, masterSeed, 'machine-B');
        const publicKeyHex = deriveSubPublicKey(masterSeed, 'machine-B');
        const parsed = verifySub(token, publicKeyHex, 'machine-B');

        expect(parsed).toMatchObject({
            lid: payload.lid,
            machineId: 'machine-B',
            v: LICENSE_VERSION,
            kid: PRODUCT_ID,
            type: 'sub',
        });
    });

    it('round-trip : préserve cust et maxStations dans le payload de sous-licence', () => {
        const payload = validSubPayload({ cust: 'École Test', maxStations: 5 });

        const token = signSub(payload, masterSeed, 'machine-B');
        const publicKeyHex = deriveSubPublicKey(masterSeed, 'machine-B');
        const parsed = verifySub(token, publicKeyHex, 'machine-B');

        expect(parsed.cust).toBe('École Test');
        expect(parsed.maxStations).toBe(5);
    });

    it('deriveSubPublicKey est déterministe (2 appels identiques) et longue de 64 hex', () => {
        const first = deriveSubPublicKey(masterSeed, 'machine-B');
        const second = deriveSubPublicKey(masterSeed, 'machine-B');

        expect(second).toBe(first);
        expect(first).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejette une sous-licence liée à une autre machine', () => {
        const token = signSub(validSubPayload(), masterSeed, 'machine-B');

        // La clé publique est dérivée pour la machine attendue (machine-C) :
        // la vérification échoue sur l'identifiant machine du jeton.
        const publicKeyHex = deriveSubPublicKey(masterSeed, 'machine-C');
        expect(() => verifySub(token, publicKeyHex, 'machine-C')).toThrow(
            /ne correspond pas à la machine demandée/
        );
    });

    it('rejette une sous-licence signée avec un autre seed maître', () => {
        const token = signSub(validSubPayload(), masterSeed, 'machine-B');

        // Clé publique dérivée d'un AUTRE seed : la signature ne correspond pas.
        const otherPublicKeyHex = deriveSubPublicKey('d'.repeat(64), 'machine-B');
        expect(() => verifySub(token, otherPublicKeyHex, 'machine-B')).toThrow(/falsifié/);
    });

    it('rejette une sous-licence vérifiée avec une clé publique qui ne correspond pas', () => {
        const token = signSub(validSubPayload(), masterSeed, 'machine-B');

        // Clé publique dérivée du BON seed mais pour une AUTRE machine : même
        // machineId dans le jeton, mais signature vérifiée contre une autre clé.
        const wrongPublicKeyHex = deriveSubPublicKey(masterSeed, 'machine-C');
        expect(() => verifySub(token, wrongPublicKeyHex, 'machine-B')).toThrow(/falsifié/);
    });

    it('rejette une sous-licence falsifiée (1 caractère modifié)', () => {
        const token = signSub(validSubPayload(), masterSeed, 'machine-B');
        const publicKeyHex = deriveSubPublicKey(masterSeed, 'machine-B');

        // Modifie le dernier caractère de la signature hexadécimale
        const last = token.charAt(token.length - 1);
        const flipped = last === 'a' ? 'b' : 'a';
        const tampered = `${token.slice(0, -1)}${flipped}`;

        expect(tampered).not.toBe(token);
        expect(() => verifySub(tampered, publicKeyHex, 'machine-B')).toThrow(/falsifié/);
    });

    it('rejette une clé publique mal formée', () => {
        const token = signSub(validSubPayload(), masterSeed, 'machine-B');

        expect(() => verifySub(token, 'pas-une-cle-hex', 'machine-B')).toThrow(/clé publique de sous-licence mal formée/);
        expect(() => verifySub(token, 'abcd', 'machine-B')).toThrow(/32 octets attendus/);
    });
});

describe('Empreinte machine', () => {
    it('est non vide et déterministe (2 appels identiques)', () => {
        const first = buildMachineFingerprint();
        const second = buildMachineFingerprint();

        expect(first.length).toBeGreaterThan(0);
        expect(second).toBe(first);
    });
});

describe('Expiration (isExpired / daysRemaining)', () => {
    it('licence future : non expirée et jours restants > 0', () => {
        const future = new Date(Date.now() + 30 * DAY_MS).toISOString();

        expect(isExpired({ expiresAt: future })).toBe(false);
        const days = daysRemaining(future);
        expect(days).not.toBeNull();
        expect(days as number).toBeGreaterThan(0);
    });

    it('licence passée : expirée et jours restants nuls', () => {
        const past = new Date(Date.now() - 1000).toISOString();

        expect(isExpired({ expiresAt: past })).toBe(true);
        expect(daysRemaining(past)).toBeNull();
    });

    it('date invalide : considérée expirée, jours restants nuls', () => {
        expect(isExpired({ expiresAt: 'pas-une-date' })).toBe(true);
        expect(daysRemaining('pas-une-date')).toBeNull();
    });
});
