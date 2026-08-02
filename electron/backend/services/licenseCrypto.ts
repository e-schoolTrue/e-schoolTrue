import * as os from 'node:os';
import { machineIdSync } from 'node-machine-id';
import * as ed25519 from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

ed25519.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array =>
    sha512(ed25519.etc.concatBytes(...messages));

export const PRODUCT_ID = 'E-SCHOOL';
export const LICENSE_VERSION = 1;
export const PUBLIC_KEY_HEX = '8e19c7e0a5351b90ffface8589c68b51371d2a1cfd7f39f2f3ce9d4cc1eeb760';

const DAY_MS = 86_400_000;

/**
 * Payload d'une licence maître (signée avec la clé privée du vendeur).
 * @interface MasterLicensePayload
 * @property {number} v - Version du format de licence (doit être LICENSE_VERSION)
 * @property {string} kid - Identifiant du produit (doit être PRODUCT_ID)
 * @property {string} lid - Identifiant unique de la licence (préfixe 'MST-')
 * @property {string} cust - Nom du client / établissement
 * @property {'master'} type - Type de licence
 * @property {number} maxStations - Nombre maximal de postes autorisés
 * @property {string} seed - Seed maître (32 octets hex) pour dériver les sous-licences
 * @property {string} issuedAt - Date d'émission ISO 8601
 * @property {string} expiresAt - Date d'expiration ISO 8601
 * @property {string[]} [features] - Fonctionnalités optionnelles activées
 */
export interface MasterLicensePayload {
    v: number;
    kid: string;
    lid: string;
    cust: string;
    type: 'master';
    maxStations: number;
    seed: string;
    issuedAt: string;
    expiresAt: string;
    features?: string[];
}

/**
 * Payload d'une sous-licence (signée avec la clé dérivée du seed maître).
 * @interface SubLicensePayload
 * @property {number} v - Version du format de licence
 * @property {string} kid - Identifiant du produit
 * @property {string} lid - Identifiant unique de la sous-licence (préfixe 'SUB-')
 * @property {'sub'} type - Type de licence
 * @property {string} masterLid - Identifiant de la licence maître parente
 * @property {string} machineId - Empreinte machine à laquelle la sous-licence est liée
 * @property {string} issuedAt - Date d'émission ISO 8601
 * @property {string} expiresAt - Date d'expiration ISO 8601
 * @property {string} [cust] - Nom du client / établissement (recopié de la maître, informations d'affichage pour les postes sub)
 * @property {number} [maxStations] - Nombre maximal de postes autorisés (recopié de la maître, informations d'affichage pour les postes sub)
 */
export interface SubLicensePayload {
    v: number;
    kid: string;
    lid: string;
    type: 'sub';
    masterLid: string;
    machineId: string;
    issuedAt: string;
    expiresAt: string;
    cust?: string;
    maxStations?: number;
}

export type ParsedLicense = MasterLicensePayload | SubLicensePayload;

/**
 * Génère une paire de clés Ed25519.
 * @returns {{ privateKeyHex: string; publicKeyHex: string }} Clé privée (à garder secrète) et clé publique (à embarquer dans PUBLIC_KEY_HEX)
 */
export function generateKeyPair(): { privateKeyHex: string; publicKeyHex: string } {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    return { privateKeyHex: bytesToHex(privateKey), publicKeyHex: bytesToHex(publicKey) };
}

/**
 * Encode un payload en jeton signé : base64url(JSON) + '.' + signature hex.
 * @param {unknown} payload - Payload à encoder
 * @param {string} signatureHex - Signature Ed25519 en hexadécimal
 * @returns {string} Jeton au format "payload.signature"
 */
export function encodeToken(payload: unknown, signatureHex: string): string {
    const message = utf8ToBytes(JSON.stringify(payload));
    return `${base64UrlEncode(message)}.${signatureHex}`;
}

/**
 * Parse un jeton sans vérifier sa signature. Lève une erreur si le format est invalide.
 * @param {string} token - Jeton au format "payload.signature"
 * @returns {ParsedLicense} Payload parsé (maître ou sous-licence)
 */
export function parseToken(token: string): ParsedLicense {
    const { encodedPayload } = splitToken(token);
    return parsePayload(decodePayload(encodedPayload));
}

/**
 * Signe une licence maître avec la clé privée du vendeur.
 * @param {Omit<MasterLicensePayload, 'v' | 'kid'>} payload - Payload sans version ni identifiant produit
 * @param {string} privateKeyHex - Clé privée Ed25519 en hexadécimal
 * @returns {string} Jeton de licence maître signé
 */
export function signMaster(
    payload: Omit<MasterLicensePayload, 'v' | 'kid'>,
    privateKeyHex: string
): string {
    const fullPayload: MasterLicensePayload = { ...payload, v: LICENSE_VERSION, kid: PRODUCT_ID };
    const message = utf8ToBytes(JSON.stringify(fullPayload));
    const signature = ed25519.sign(message, parsePrivateKey(privateKeyHex));
    return `${base64UrlEncode(message)}.${bytesToHex(signature)}`;
}

/**
 * Vérifie la signature Ed25519 d'une licence maître.
 * Utilise PUBLIC_KEY_HEX par défaut ; une clé publique de test peut être
 * fournie pour vérifier des jetons signés avec une autre paire de clés.
 * Lève une erreur (message en français) si le jeton est invalide ou falsifié.
 * @param {string} token - Jeton de licence maître
 * @param {string} [publicKeyHex=PUBLIC_KEY_HEX] - Clé publique Ed25519 en hexadécimal
 * @returns {MasterLicensePayload} Payload vérifié
 */
export function verifyMaster(token: string, publicKeyHex: string = PUBLIC_KEY_HEX): MasterLicensePayload {
    const { encodedPayload, signatureHex } = splitToken(token);
    const payload = parseToken(token);
    if (payload.type !== 'master') {
        throw new Error('Licence invalide : le jeton n\'est pas une licence maître.');
    }
    assertCommonFields(payload.v, payload.kid);
    const valid = ed25519.verify(
        parseSignature(signatureHex),
        base64UrlDecode(encodedPayload),
        hexToBytes(publicKeyHex)
    );
    if (!valid) {
        throw new Error('Signature invalide : la licence a été falsifiée ou provient d\'une autre clé.');
    }
    return payload;
}

/**
 * Dérive la clé Ed25519 (32 octets) servant à signer/vérifier les sous-licences
 * d'une machine donnée : sha256(seed maître + '|sub|' + machineId).
 * @param {string} masterSeed - Seed maître (32 octets hex) de la licence maître
 * @param {string} machineId - Empreinte machine cible
 * @returns {Uint8Array} Seed Ed25519 de 32 octets
 */
export function deriveSubSignKey(masterSeed: string, machineId: string): Uint8Array {
    if (masterSeed.length === 0 || machineId.length === 0) {
        throw new Error('Dérivation de clé impossible : seed maître ou identifiant machine manquant.');
    }
    return sha256(utf8ToBytes(`${masterSeed}|sub|${machineId}`));
}

/**
 * Dérive la clé publique Ed25519 (hex) qui permet à un poste sub de vérifier
 * sa sous-licence sans jamais détenir le seed maître :
 * getPublicKey(deriveSubSignKey(masterSeed, machineId)).
 * C'est cette clé publique que le poste principal fournit aux postes cibles
 * dans le paquet de sous-licence (token + clé publique).
 * @param {string} masterSeed - Seed maître (32 octets hex) de la licence maître
 * @param {string} machineId - Empreinte machine cible
 * @returns {string} Clé publique Ed25519 en hexadécimal (64 caractères)
 */
export function deriveSubPublicKey(masterSeed: string, machineId: string): string {
    return bytesToHex(ed25519.getPublicKey(deriveSubSignKey(masterSeed, machineId)));
}

/**
 * Signe une sous-licence avec la clé dérivée du seed maître pour la machine cible.
 * @param {Omit<SubLicensePayload, 'v' | 'kid'>} payload - Payload sans version ni identifiant produit
 * @param {string} masterSeed - Seed maître de la licence maître
 * @param {string} machineId - Empreinte machine cible
 * @returns {string} Jeton de sous-licence signé
 */
export function signSub(
    payload: Omit<SubLicensePayload, 'v' | 'kid'>,
    masterSeed: string,
    machineId: string
): string {
    const fullPayload: SubLicensePayload = { ...payload, v: LICENSE_VERSION, kid: PRODUCT_ID };
    const message = utf8ToBytes(JSON.stringify(fullPayload));
    const signature = ed25519.sign(message, deriveSubSignKey(masterSeed, machineId));
    return `${base64UrlEncode(message)}.${bytesToHex(signature)}`;
}

/**
 * Vérifie une sous-licence : version, produit, type, machineId et signature
 * Ed25519 contre la clé publique dérivée du seed maître pour la machine
 * attendue. La clé publique est fournie par le poste principal (paquet de
 * sous-licence) : le seed maître n'est jamais transmis aux postes sub, ce qui
 * empêche de forger des sous-licences supplémentaires depuis un poste sub.
 * Lève une erreur (message en français) si invalide.
 * @param {string} token - Jeton de sous-licence
 * @param {string} publicKeyHex - Clé publique dérivée (hex) fournie par le poste principal
 * @param {string} machineId - Empreinte machine attendue
 * @returns {SubLicensePayload} Payload vérifié
 */
export function verifySub(token: string, publicKeyHex: string, machineId: string): SubLicensePayload {
    const { encodedPayload, signatureHex } = splitToken(token);
    const payload = parseToken(token);
    if (payload.type !== 'sub') {
        throw new Error('Licence invalide : le jeton n\'est pas une sous-licence.');
    }
    assertCommonFields(payload.v, payload.kid);
    if (payload.machineId !== machineId) {
        throw new Error('Sous-licence invalide : l\'identifiant machine du jeton ne correspond pas à la machine demandée.');
    }
    let publicKey: Uint8Array;
    try {
        publicKey = hexToBytes(publicKeyHex);
    } catch {
        throw new Error('Licence invalide : clé publique de sous-licence mal formée.');
    }
    if (publicKey.length !== 32) {
        throw new Error('Licence invalide : clé publique de sous-licence mal formée (32 octets attendus).');
    }
    const valid = ed25519.verify(
        parseSignature(signatureHex),
        base64UrlDecode(encodedPayload),
        publicKey
    );
    if (!valid) {
        throw new Error('Signature de sous-licence invalide : le jeton a été falsifié.');
    }
    return payload;
}

/**
 * Construit l'empreinte machine locale : base64url(sha256(machineId|hostname|platform|arch|ramGo|cpuModel)).
 * @returns {string} Empreinte machine stable pour lier une sous-licence à un poste
 */
export function buildMachineFingerprint(): string {
    let machineId: string;
    try {
        machineId = machineIdSync(true);
    } catch {
        machineId = 'machine-inconnue';
    }
    const cpuModel = os.cpus()[0]?.model ?? 'inconnu';
    const source =
        `${machineId}|${os.hostname()}|${os.platform()}|${os.arch()}|` +
        `${String(Math.round(os.totalmem() / 1073741824))}|${cpuModel}`;
    return base64UrlEncode(sha256(utf8ToBytes(source)));
}

/**
 * Indique si la licence est expirée (date d'expiration dépassée ou invalide).
 * @param {{ expiresAt: string }} payload - Payload contenant la date d'expiration
 * @returns {boolean} true si expirée
 */
export function isExpired(payload: { expiresAt: string }): boolean {
    const time = new Date(payload.expiresAt).getTime();
    if (Number.isNaN(time)) return true;
    return time < Date.now();
}

/**
 * Nombre de jours restants avant expiration (arrondi au supérieur).
 * Retourne null si la licence est expirée ou si la date est invalide.
 * @param {string} expiresAt - Date d'expiration ISO 8601
 * @returns {number | null} Jours restants, ou null si expirée/invalide
 */
export function daysRemaining(expiresAt: string): number | null {
    const time = new Date(expiresAt).getTime();
    if (Number.isNaN(time)) return null;
    const days = Math.ceil((time - Date.now()) / DAY_MS);
    return days > 0 ? days : null;
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    let binary: string;
    try {
        binary = atob(padded);
    } catch {
        throw new Error('Licence invalide : le payload est mal encodé.');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function splitToken(token: string): { encodedPayload: string; signatureHex: string } {
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Licence invalide : jeton vide ou manquant.');
    }
    const separatorIndex = token.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex >= token.length - 1) {
        throw new Error('Licence invalide : format attendu "payload.signature".');
    }
    return {
        encodedPayload: token.slice(0, separatorIndex),
        signatureHex: token.slice(separatorIndex + 1),
    };
}

function decodePayload(encodedPayload: string): unknown {
    let raw: unknown;
    try {
        raw = JSON.parse(bytesToUtf8(base64UrlDecode(encodedPayload)));
    } catch {
        throw new Error('Licence invalide : le payload JSON est corrompu.');
    }
    return raw;
}

function parsePayload(raw: unknown): ParsedLicense {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('Licence invalide : le payload n\'est pas un objet JSON.');
    }
    const record = raw as Record<string, unknown>;
    if (record['type'] === 'master') {
        const featuresValue = record['features'];
        let features: string[] | undefined;
        if (featuresValue !== undefined) {
            if (!Array.isArray(featuresValue) || featuresValue.some((f) => typeof f !== 'string')) {
                throw new Error('Licence invalide : le champ \'features\' est mal formaté.');
            }
            features = featuresValue as string[];
        }
        return {
            v: requireNumber(record, 'v'),
            kid: requireString(record, 'kid'),
            lid: requireString(record, 'lid'),
            cust: requireString(record, 'cust'),
            type: 'master',
            maxStations: requireNumber(record, 'maxStations'),
            seed: requireString(record, 'seed'),
            issuedAt: requireString(record, 'issuedAt'),
            expiresAt: requireString(record, 'expiresAt'),
            features,
        };
    }
    if (record['type'] === 'sub') {
        const custValue = record['cust'];
        let cust: string | undefined;
        if (custValue !== undefined) {
            if (typeof custValue !== 'string' || custValue.length === 0) {
                throw new Error('Licence invalide : le champ \'cust\' est mal formaté.');
            }
            cust = custValue;
        }
        const maxStationsValue = record['maxStations'];
        let maxStations: number | undefined;
        if (maxStationsValue !== undefined) {
            if (typeof maxStationsValue !== 'number' || !Number.isFinite(maxStationsValue)) {
                throw new Error('Licence invalide : le champ \'maxStations\' est mal formaté.');
            }
            maxStations = maxStationsValue;
        }
        return {
            v: requireNumber(record, 'v'),
            kid: requireString(record, 'kid'),
            lid: requireString(record, 'lid'),
            type: 'sub',
            masterLid: requireString(record, 'masterLid'),
            machineId: requireString(record, 'machineId'),
            issuedAt: requireString(record, 'issuedAt'),
            expiresAt: requireString(record, 'expiresAt'),
            cust,
            maxStations,
        };
    }
    throw new Error(`Licence invalide : type inconnu '${String(record['type'])}'.`);
}

function requireString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Licence invalide : le champ '${key}' est manquant ou mal formaté.`);
    }
    return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Licence invalide : le champ '${key}' est manquant ou mal formaté.`);
    }
    return value;
}

function assertCommonFields(v: number, kid: string): void {
    if (v !== LICENSE_VERSION) {
        throw new Error(`Licence invalide : version ${String(v)} non prise en charge (attendue : ${String(LICENSE_VERSION)}).`);
    }
    if (kid !== PRODUCT_ID) {
        throw new Error(`Licence invalide : produit '${kid}' inconnu (attendu : '${PRODUCT_ID}').`);
    }
}

function parsePrivateKey(privateKeyHex: string): Uint8Array {
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
        throw new Error('Clé privée invalide : 64 caractères hexadécimaux (32 octets) attendus.');
    }
    return hexToBytes(privateKeyHex);
}

function parseSignature(signatureHex: string): Uint8Array {
    let signature: Uint8Array;
    try {
        signature = hexToBytes(signatureHex);
    } catch {
        throw new Error('Licence invalide : signature mal formée.');
    }
    if (signature.length !== 64) {
        throw new Error('Licence invalide : signature mal formée (64 octets attendus).');
    }
    return signature;
}
