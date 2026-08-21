import { randomBytes } from 'node:crypto';
import { ElectronStore } from '../utils/electronStore';
import {
    buildMachineFingerprint,
    buildMachineFingerprintLegacy,
    verifyMaster,
    verifySub,
    signSub,
    deriveSubPublicKey,
    isExpired,
    daysRemaining,
} from './licenseCrypto';
import type { MasterLicensePayload, SubLicensePayload } from './licenseCrypto';

/**
 * Tolérance de dérive d'horloge avant de considérer un retour arrière (rollback)
 * comme une tentative de prolongation frauduleuse de la licence (5 minutes).
 */
const CLOCK_SKEW_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Clés de stockage (ElectronStore 'license').
 */
const STORE_MASTER = 'master';
const STORE_MASTER_MACHINE = 'masterMachine';
const STORE_SUBS = 'subs';
const STORE_SUB_KEYS = 'subKeys';
const STORE_CLOCK_LAST_SEEN = 'clockLastSeen';

/**
 * Carte des sous-licences : empreinte machine -> jeton de sous-licence.
 */
type SubsMap = Record<string, string>;

/**
 * Carte des clés publiques de vérification des sous-licences :
 * empreinte machine -> clé publique dérivée (hex) fournie par le poste principal.
 * Le poste sub vérifie sa sous-licence avec cette clé publique, jamais avec le seed.
 */
type SubKeysMap = Record<string, string>;

/**
 * Données de statut de licence retournées par {@link LicenseService.getStatus}.
 */
export interface LicenseStatusData {
    isValid: boolean;
    machineId: string;
    licenseType: 'master' | 'sub' | null;
    customer: string | null;
    expiryDate: string | null;
    daysRemaining: number | null;
    stationIndex: number | null;
    maxStations: number | null;
    /** true si un retour arrière d'horloge a été détecté (champ additionnel, hors contrat de base). */
    clockError?: boolean;
}

export interface LicenseStatusResult {
    success: boolean;
    message?: string;
    data: LicenseStatusData;
}

export interface LicenseDetailsData {
    isValid: boolean;
    maxStations: number | null;
    usedStations: number | null;
    customer: string | null;
    licenseType: string | null;
    expiresAt: string | null;
}

export interface LicenseDetailsResult {
    success: boolean;
    data: LicenseDetailsData;
}

export interface ActivateResult {
    success: boolean;
    message?: string;
    data?: { licenseType: string };
}

export interface GenerateSubResult {
    success: boolean;
    data?: { subLicenseCode: string };
    message?: string;
}

/**
 * Formate une date ISO en français lisible (ex. « 12/03/2027 »).
 * Retourne la valeur brute si la date est invalide.
 */
function formatDateFr(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('fr-FR');
}

/**
 * Message d'erreur lisible depuis une exception inconnue.
 */
function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/**
 * Service de licence 100 % hors-ligne.
 *
 * Persistance via `ElectronStore('license')` :
 * - `master`        : jeton de la licence maître (string) — uniquement sur le poste principal
 * - `masterMachine` : empreinte machine qui a activé la maître (string)
 * - `subs`          : JSON `{ '<machineId>': '<tokenSub>' }`
 * - `subKeys`       : JSON `{ '<machineId>': '<clé publique dérivée hex>' }`
 * - `clockLastSeen` : `String(Date.now())` en millisecondes (anti-rollback horloge)
 *
 * Les postes sub ne stockent JAMAIS la maître (ni le seed) : ils vérifient leur
 * sous-licence avec la clé publique dérivée fournie par le poste principal
 * (paquet « token + clé publique »).
 */
export class LicenseService {
    private storeInstance: ElectronStore | null = null;

    private get store(): ElectronStore {
        if (!this.storeInstance) {
            this.storeInstance = new ElectronStore('license');
        }
        return this.storeInstance;
    }

    /**
     * Empreinte stable de la machine courante.
     * @returns {string} Empreinte machine (base64url de sha256)
     */
    public getMachineId(): string {
        try {
            return buildMachineFingerprint();
        } catch (error) {
            console.error('[LicenseService] Erreur lors de la génération de l\'empreinte machine :', error);
            throw new Error('Impossible de générer l\'identifiant de cette machine.');
        }
    }

    /**
     * Active une licence maître sur ce poste (poste principal).
     * @param {string} code - Jeton de licence maître signé
     */
    public async activateMaster(code: string): Promise<ActivateResult> {
        try {
            let master: MasterLicensePayload;
            try {
                master = verifyMaster(code);
            } catch (error) {
                const message = errorMessage(error, 'Code de licence maître invalide.');
                console.error('[LicenseService] Activation maître refusée :', message);
                return { success: false, message };
            }

            if (isExpired(master)) {
                return { success: false, message: `Licence expirée depuis le ${formatDateFr(master.expiresAt)}.` };
            }

            const currentMachineId = this.getMachineId();

            // Les sous-licences existantes sont liées à l'ancien seed : invalides
            // dès qu'une nouvelle maître est écrite. On les purge avant l'écriture
            // pour éviter un quota fantôme (P3).
            await this.store.removeItem(STORE_SUBS);
            await this.store.removeItem(STORE_SUB_KEYS);

            await this.store.setItem(STORE_MASTER, code);
            await this.store.setItem(STORE_MASTER_MACHINE, currentMachineId);

            console.log('[LicenseService] Licence maître activée avec succès (machine', currentMachineId, ').');
            return { success: true, message: 'Licence maître activée avec succès.', data: { licenseType: 'master' } };
        } catch (error) {
            console.error('[LicenseService] Erreur lors de l\'activation de la licence maître :', error);
            return { success: false, message: 'Erreur inattendue lors de l\'activation de la licence maître.' };
        }
    }

    /**
     * Active une sous-licence (poste secondaire) à partir du paquet fourni par
     * le poste principal : `token` (ligne 1) + `clé publique dérivée` (ligne 2).
     * Le poste sub vérifie sa sous-licence avec la clé publique fournie et ne
     * stocke jamais la maître ni le seed (P1).
     * @param {string} packageText - Paquet multi-lignes brut « jeton + clé publique » (normalisé par trim)
     */
    public async activateSub(packageText: string): Promise<ActivateResult> {
        try {
            // 1. Normaliser le texte multi-lignes brut (l'UI peut coller le paquet entier)
            const lines = packageText
                .trim()
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            const token = lines[0];
            if (token === undefined) {
                return { success: false, message: 'Paquet de sous-licence vide.' };
            }

            const machineId = this.getMachineId();
            const masterMachine = await this.store.getItem(STORE_MASTER_MACHINE);

            // 2. Clé publique de vérification : ligne 2 du paquet, ou dérivation
            //    locale autorisée uniquement sur le poste principal (qui détient le seed).
            let pubKeyHex: string | undefined = lines[1];
            if (pubKeyHex === undefined && masterMachine === machineId) {
                const masterToken = await this.store.getItem(STORE_MASTER);
                if (masterToken !== null) {
                    try {
                        const master = verifyMaster(masterToken);
                        if (!isExpired(master)) {
                            pubKeyHex = deriveSubPublicKey(master.seed, machineId);
                        }
                    } catch (error) {
                        const message = errorMessage(error, 'Licence maître stockée invalide.');
                        console.error('[LicenseService] Licence maître invalide lors de l\'activation d\'une sous-licence :', message);
                    }
                }
            }
            if (pubKeyHex === undefined) {
                return {
                    success: false,
                    message: 'Paquet de sous-licence incomplet : collez le jeton et la clé publique fournis par le poste principal.',
                };
            }

            // 3. Le poste principal ne s'active pas lui-même en sous-licence
            if (masterMachine === machineId) {
                return {
                    success: false,
                    message: 'Ce poste est déjà le poste principal de la licence.',
                };
            }

            // 4. Vérifier la sous-licence pour la machine courante (clé publique dérivée)
            let sub: SubLicensePayload;
            try {
                sub = verifySub(token, pubKeyHex, machineId);
            } catch (error) {
                const message = errorMessage(error, 'Paquet de sous-licence invalide pour cette machine.');
                console.error('[LicenseService] Activation sous-licence refusée :', message);
                return { success: false, message };
            }

            if (isExpired(sub)) {
                return {
                    success: false,
                    message: `La sous-licence est expirée depuis le ${formatDateFr(sub.expiresAt)}.`,
                };
            }

            // 5. Stocker la sous-licence et sa clé publique de vérification.
            //    La maître (qui contient le seed) n'est JAMAIS stockée sur un poste sub.
            const subs = await this.loadSubs();
            subs[machineId] = token;
            await this.saveSubs(subs);
            const subKeys = await this.loadSubKeys();
            subKeys[machineId] = pubKeyHex;
            await this.saveSubKeys(subKeys);

            console.log('[LicenseService] Sous-licence activée avec succès (machine', machineId, ').');
            return { success: true, message: 'Sous-licence activée avec succès.', data: { licenseType: 'sub' } };
        } catch (error) {
            console.error('[LicenseService] Erreur lors de l\'activation de la sous-licence :', error);
            return { success: false, message: 'Erreur inattendue lors de l\'activation de la sous-licence.' };
        }
    }

    /**
     * Génère une sous-licence signée pour une machine cible (ou la machine courante).
     * @param {string} [targetMachineId] - Empreinte machine cible ; la machine courante si absente
     */
    public async generateSub(targetMachineId?: string): Promise<GenerateSubResult> {
        try {
            // 1. Exiger une licence maître valide et non expirée
            const masterToken = await this.store.getItem(STORE_MASTER);
            if (!masterToken) {
                return {
                    success: false,
                    message: 'Aucune licence maître active. Activez d\'abord la licence principale sur ce poste.',
                };
            }

            let master: MasterLicensePayload;
            try {
                master = verifyMaster(masterToken);
            } catch (error) {
                const message = errorMessage(error, 'Licence maître stockée invalide.');
                console.error('[LicenseService] Licence maître invalide lors de la génération d\'une sous-licence :', message);
                return { success: false, message };
            }

            if (isExpired(master)) {
                return {
                    success: false,
                    message: `La licence maître est expirée depuis le ${formatDateFr(master.expiresAt)}.`,
                };
            }

            // 2. Seul le poste principal (celui qui a activé la maître) génère des sous-licences
            const masterMachine = await this.store.getItem(STORE_MASTER_MACHINE);
            const currentMachineId = this.getMachineId();
            if (masterMachine !== currentMachineId) {
                return {
                    success: false,
                    message: 'Seul le poste principal peut générer des sous-licences.',
                };
            }

            // 3. Machine cible
            const machineId = targetMachineId ?? currentMachineId;

            // 4. Respecter le quota de postes (remplacement si la cible a déjà une sous-licence).
            //    Le poste maître compte pour 1 : au maximum (maxStations - 1) sous-licences.
            const subs = await this.loadSubs();
            if (subs[machineId] === undefined) {
                const usedStations = Object.keys(subs).length + 1;
                if (usedStations >= master.maxStations) {
                    return { success: false, message: `Limite de postes atteinte (max ${master.maxStations}).` };
                }
            }

            // 5. Construire, signer et stocker la sous-licence
            const now = new Date().toISOString();
            const token = signSub(
                {
                    lid: `SUB-${randomBytes(4).toString('hex')}`,
                    type: 'sub',
                    masterLid: master.lid,
                    machineId,
                    // Informations d'affichage recopiées de la maître pour les postes sub
                    cust: master.cust,
                    maxStations: master.maxStations,
                    issuedAt: now,
                    expiresAt: master.expiresAt,
                },
                master.seed,
                machineId
            );

            // Clé publique de vérification dérivée du seed : c'est elle (jamais le
            // seed) qui est fournie au poste cible pour vérifier la sous-licence.
            const pubKey = deriveSubPublicKey(master.seed, machineId);

            subs[machineId] = token;
            await this.saveSubs(subs);
            const subKeys = await this.loadSubKeys();
            subKeys[machineId] = pubKey;
            await this.saveSubKeys(subKeys);

            console.log('[LicenseService] Sous-licence générée avec succès (machine', machineId, ').');
            // Paquet à coller sur le poste cible : jeton (ligne 1) + clé publique (ligne 2)
            return { success: true, data: { subLicenseCode: `${token}\n${pubKey}` } };
        } catch (error) {
            console.error('[LicenseService] Erreur lors de la génération de la sous-licence :', error);
            return { success: false, message: 'Erreur inattendue lors de la génération de la sous-licence.' };
        }
    }

    /**
     * Statut de la licence sur le poste courant (validité, type, dates, quota,
     * détection de retour arrière d'horloge).
     */
    public async getStatus(): Promise<LicenseStatusResult> {
        try {
            const machineId = this.getMachineId();

            const baseData = (overrides: Partial<LicenseStatusData>): LicenseStatusData => ({
                isValid: false,
                machineId,
                licenseType: null,
                customer: null,
                expiryDate: null,
                daysRemaining: null,
                stationIndex: null,
                maxStations: null,
                ...overrides,
            });

            // 1. Charger la maître (présente uniquement sur le poste principal)
            //    et les sous-licences locales (jeton + clé publique dérivée).
            const masterToken = await this.store.getItem(STORE_MASTER);
            const subs = await this.loadSubs();
            const subKeys = await this.loadSubKeys();

            // 2. Déterminer le type de poste courant (maître ou sous-licence)
            let licenseType: 'master' | 'sub' | null = null;
            let stationIndex: number | null = null;
            let stationValid = false;
            let customer: string | null = null;
            let expiryDate: string | null = null;
            let maxStations: number | null = null;

            if (masterToken !== null) {
                // Licence maître stockée : poste principal, ou poste sub héritant
                // d'une ancienne version (qui stockait la maître).
                let master: MasterLicensePayload;
                try {
                    master = verifyMaster(masterToken);
                } catch (error) {
                    console.error('[LicenseService] Licence maître stockée invalide :', error);
                    return { success: true, data: baseData({}) };
                }

                const masterMachine = await this.store.getItem(STORE_MASTER_MACHINE);
                let legacyMachine: string | null = null;
                try { legacyMachine = buildMachineFingerprintLegacy(); } catch {}
                const isMasterMachine = masterMachine === machineId || (legacyMachine !== null && masterMachine === legacyMachine);
                if (isMasterMachine) {
                    // Poste principal : la maître gouverne le statut (accepte legacy pour rétro-compat)
                    licenseType = 'master';
                    stationIndex = 1;
                    stationValid = !isExpired(master);
                    customer = master.cust;
                    expiryDate = master.expiresAt;
                    maxStations = master.maxStations;
                } else {
                    // Poste non principal : le statut est gouverné par la sous-licence locale
                    const subStatus = this.evaluateSubStatus(subs, subKeys, machineId);
                    licenseType = subStatus.licenseType;
                    stationIndex = subStatus.stationIndex;
                    stationValid = subStatus.stationValid;
                    customer = subStatus.customer;
                    expiryDate = subStatus.expiryDate;
                    maxStations = subStatus.maxStations;
                }
            } else {
                // Aucune maître stockée : poste sub (le nouveau design ne stocke
                // jamais la maître sur les postes secondaires)
                const subStatus = this.evaluateSubStatus(subs, subKeys, machineId);
                licenseType = subStatus.licenseType;
                stationIndex = subStatus.stationIndex;
                stationValid = subStatus.stationValid;
                customer = subStatus.customer;
                expiryDate = subStatus.expiryDate;
                maxStations = subStatus.maxStations;
            }

            // 3. Anti-rollback horloge : refuser si l'horloge a reculé de plus de
            //    24h. Uniquement lorsqu'une licence existe (maître ou
            //    sous-licence locale) : une machine vierge n'écrit pas d'horodatage.
            let hasLocalLicense = masterToken !== null || subs[machineId] !== undefined;
            if (!hasLocalLicense) {
                try {
                    const legacyId2 = buildMachineFingerprintLegacy();
                    if (legacyId2 !== machineId && subs[legacyId2] !== undefined) hasLocalLicense = true;
                } catch {}
            }
            const now = Date.now();
            const clockLastSeen = await this.store.getItem(STORE_CLOCK_LAST_SEEN);
            let clockError = false;
            if (hasLocalLicense && clockLastSeen !== null) {
                const lastSeen = Number(clockLastSeen);
                if (Number.isFinite(lastSeen) && now < lastSeen - CLOCK_SKEW_TOLERANCE_MS) {
                    clockError = true;
                }
            }
            if (hasLocalLicense && !clockError) {
                await this.store.setItem(STORE_CLOCK_LAST_SEEN, String(now));
            }
            if (clockError) {
                console.warn('[LicenseService] Retour arrière d\'horloge détecté (dernier passage', clockLastSeen, ', maintenant', now, ').');
                return {
                    success: true,
                    message: 'L\'horloge système a été reculée. Réinitialisez la date et l\'heure, puis redémarrez l\'application.',
                    data: baseData({
                        licenseType,
                        customer,
                        expiryDate,
                        daysRemaining: 0,
                        stationIndex,
                        maxStations,
                        clockError: true,
                    }),
                };
            }

            const remaining = expiryDate !== null ? daysRemaining(expiryDate) : null;

            // 4. Poste non reconnu (ni maître, ni sous-licence valide)
            if (!stationValid) {
                return {
                    success: true,
                    data: baseData({
                        licenseType,
                        customer,
                        expiryDate,
                        daysRemaining: remaining,
                        maxStations,
                    }),
                };
            }

            // 5. Poste valide
            return {
                success: true,
                data: {
                    isValid: true,
                    machineId,
                    licenseType,
                    customer,
                    expiryDate,
                    daysRemaining: remaining,
                    stationIndex,
                    maxStations,
                },
            };
        } catch (error) {
            console.error('[LicenseService] Erreur lors de la lecture du statut de licence :', error);
            return {
                success: true,
                data: {
                    isValid: false,
                    machineId: this.getMachineId(),
                    licenseType: null,
                    customer: null,
                    expiryDate: null,
                    daysRemaining: null,
                    stationIndex: null,
                    maxStations: null,
                },
            };
        }
    }

    /**
     * Détails de la licence pour l'interface (quota utilisé, client, expiration).
     */
    public async getDetails(): Promise<LicenseDetailsResult> {
        try {
            const machineId = this.getMachineId();

            const masterToken = await this.store.getItem(STORE_MASTER);
            const subs = await this.loadSubs();
            const subKeys = await this.loadSubKeys();

            // Poste principal : la maître gouverne les détails.
            if (masterToken !== null) {
                let master: MasterLicensePayload;
                try {
                    master = verifyMaster(masterToken);
                } catch (error) {
                    console.error('[LicenseService] Licence maître stockée invalide :', error);
                    return {
                        success: true,
                        data: {
                            isValid: false,
                            maxStations: null,
                            usedStations: null,
                            customer: null,
                            licenseType: null,
                            expiresAt: null,
                        },
                    };
                }

                const masterMachine = await this.store.getItem(STORE_MASTER_MACHINE);
                if (masterMachine === machineId) {
                    // Sémantique « nombre de postes utilisés du point de vue de ce
                    // poste » : le poste principal voit lui-même (1) + chaque
                    // sous-licence générée.
                    return {
                        success: true,
                        data: {
                            isValid: !isExpired(master),
                            maxStations: master.maxStations,
                            usedStations: Object.keys(subs).length + 1,
                            customer: master.cust,
                            licenseType: 'master',
                            expiresAt: master.expiresAt,
                        },
                    };
                }
                // Maître présente mais poste non principal (ancienne version) :
                // on évalue la sous-licence locale, comme sur un poste sub.
            }

            // Poste sub : le poste courant est le seul poste « utilisé » visible
            // d'ici (la maître et les autres sous-licences ne sont pas connues
            // localement) : usedStations = 1.
            const subToken = subs[machineId];
            const pubKeyHex = subKeys[machineId];
            if (subToken !== undefined && pubKeyHex !== undefined) {
                try {
                    const sub = verifySub(subToken, pubKeyHex, machineId);
                    return {
                        success: true,
                        data: {
                            isValid: !isExpired(sub),
                            maxStations: sub.maxStations ?? null,
                            usedStations: 1,
                            customer: sub.cust ?? null,
                            licenseType: 'sub',
                            expiresAt: sub.expiresAt,
                        },
                    };
                } catch (error) {
                    console.warn('[LicenseService] Sous-licence du poste invalide (détails) :', error);
                    return {
                        success: true,
                        data: {
                            isValid: false,
                            maxStations: null,
                            usedStations: null,
                            customer: null,
                            licenseType: 'sub',
                            expiresAt: null,
                        },
                    };
                }
            }

            // Aucune licence locale (ni maître, ni sous-licence)
            return {
                success: true,
                data: {
                    isValid: false,
                    maxStations: null,
                    usedStations: null,
                    customer: null,
                    licenseType: null,
                    expiresAt: null,
                },
            };
        } catch (error) {
            console.error('[LicenseService] Erreur lors de la lecture des détails de licence :', error);
            return {
                success: true,
                data: {
                    isValid: false,
                    maxStations: null,
                    usedStations: null,
                    customer: null,
                    licenseType: null,
                    expiresAt: null,
                },
            };
        }
    }

    /**
     * Retire la sous-licence d'un poste cible. Réservé au poste principal.
     * @param {string} targetMachineId - Empreinte machine du poste dont la sous-licence est retirée
     * @returns {{ success: boolean; message?: string }} Succès ou message d'erreur en français
     */
    public async removeSub(targetMachineId: string): Promise<{ success: boolean; message?: string }> {
        try {
            const machineId = this.getMachineId();
            const masterMachine = await this.store.getItem(STORE_MASTER_MACHINE);
            if (masterMachine !== machineId) {
                return { success: false, message: 'Seul le poste principal peut retirer une sous-licence.' };
            }

            const subs = await this.loadSubs();
            if (subs[targetMachineId] === undefined) {
                return { success: false, message: 'Aucune sous-licence pour ce poste.' };
            }

            delete subs[targetMachineId];
            await this.saveSubs(subs);

            const subKeys = await this.loadSubKeys();
            delete subKeys[targetMachineId];
            await this.saveSubKeys(subKeys);

            console.log('[LicenseService] Sous-licence retirée (machine', targetMachineId, ').');
            return { success: true };
        } catch (error) {
            console.error('[LicenseService] Erreur lors du retrait de la sous-licence :', error);
            return { success: false, message: 'Erreur inattendue lors du retrait de la sous-licence.' };
        }
    }

    // -------------------------------------------------------------------------
    // Helpers internes
    // -------------------------------------------------------------------------

    /**
     * Charge la carte des sous-licences depuis le stockage.
     * Retourne un objet vide si absent ou corrompu.
     */
    private async loadSubs(): Promise<SubsMap> {
        const raw = await this.store.getItem(STORE_SUBS);
        if (raw === null) return {};
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                console.warn('[LicenseService] Stockage des sous-licences au format inattendu, ignoré.');
                return {};
            }
            const subs: SubsMap = {};
            const record = parsed as Record<string, unknown>;
            for (const machineId of Object.keys(record)) {
                const token = record[machineId];
                if (typeof token === 'string' && token.length > 0) {
                    subs[machineId] = token;
                }
            }
            return subs;
        } catch (error) {
            console.error('[LicenseService] Stockage des sous-licences illisible :', error);
            return {};
        }
    }

    /**
     * Persiste la carte des sous-licences.
     */
    private async saveSubs(subs: SubsMap): Promise<void> {
        await this.store.setItem(STORE_SUBS, JSON.stringify(subs));
    }

    /**
     * Charge la carte des clés publiques de vérification des sous-licences.
     * Retourne un objet vide si absent ou corrompu.
     */
    private async loadSubKeys(): Promise<SubKeysMap> {
        const raw = await this.store.getItem(STORE_SUB_KEYS);
        if (raw === null) return {};
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                console.warn('[LicenseService] Stockage des clés publiques de sous-licences au format inattendu, ignoré.');
                return {};
            }
            const subKeys: SubKeysMap = {};
            const record = parsed as Record<string, unknown>;
            for (const machineId of Object.keys(record)) {
                const publicKeyHex = record[machineId];
                if (typeof publicKeyHex === 'string' && publicKeyHex.length > 0) {
                    subKeys[machineId] = publicKeyHex;
                }
            }
            return subKeys;
        } catch (error) {
            console.error('[LicenseService] Stockage des clés publiques de sous-licences illisible :', error);
            return {};
        }
    }

    /**
     * Persiste la carte des clés publiques de vérification des sous-licences.
     */
    private async saveSubKeys(subKeys: SubKeysMap): Promise<void> {
        await this.store.setItem(STORE_SUB_KEYS, JSON.stringify(subKeys));
    }

    /**
     * Évalue la sous-licence locale d'un poste sub (jeton + clé publique dérivée).
     * Retourne le type de poste, la position (1-indexée) dans `subs`, et les
     * informations d'affichage (client, expiration, postes max) depuis le payload.
     * Si le jeton est présent mais invalide, le poste reste identifié comme
     * « sub » mais non valide.
     */
    private evaluateSubStatus(
        subs: SubsMap,
        subKeys: SubKeysMap,
        machineId: string
    ): {
        licenseType: 'sub' | null;
        stationIndex: number | null;
        stationValid: boolean;
        customer: string | null;
        expiryDate: string | null;
        maxStations: number | null;
    } {
        // Essayer d'abord l'empreinte actuelle, sinon legacy (rétro-compat)
        let subToken = subs[machineId];
        let pubKeyHex = subKeys[machineId];
        let effectiveMachineId = machineId;
        if ((subToken === undefined || pubKeyHex === undefined) && machineId) {
            try {
                const legacyId = buildMachineFingerprintLegacy();
                if (legacyId !== machineId && subs[legacyId] !== undefined && subKeys[legacyId] !== undefined) {
                    console.log('[LicenseService] Fallback legacy fingerprint pour sous-licence');
                    subToken = subs[legacyId];
                    pubKeyHex = subKeys[legacyId];
                    effectiveMachineId = legacyId;
                }
            } catch {}
        }
        if (subToken === undefined || pubKeyHex === undefined) {
            return {
                licenseType: null,
                stationIndex: null,
                stationValid: false,
                customer: null,
                expiryDate: null,
                maxStations: null,
            };
        }
        try {
            const sub = verifySub(subToken, pubKeyHex, effectiveMachineId);
            const valid = !isExpired(sub);
            return {
                licenseType: 'sub',
                stationIndex: valid ? this.computeStationIndex(subs, effectiveMachineId) : null,
                stationValid: valid,
                customer: sub.cust ?? null,
                expiryDate: sub.expiresAt,
                maxStations: sub.maxStations ?? null,
            };
        } catch (error) {
            // Si échec avec empreinte actuelle, tenter legacy si différent
            try {
                const legacyId = buildMachineFingerprintLegacy();
                if (legacyId !== effectiveMachineId && subs[legacyId] !== undefined) {
                    const subLegacy = verifySub(subs[legacyId], subKeys[legacyId], legacyId);
                    const valid = !isExpired(subLegacy);
                    return {
                        licenseType: 'sub',
                        stationIndex: valid ? this.computeStationIndex(subs, legacyId) : null,
                        stationValid: valid,
                        customer: subLegacy.cust ?? null,
                        expiryDate: subLegacy.expiresAt,
                        maxStations: subLegacy.maxStations ?? null,
                    };
                }
            } catch {}
            console.warn('[LicenseService] Sous-licence du poste invalide :', error);
            // Jeton présent mais invalide ou expiré : poste « sub » défaillant
            return {
                licenseType: 'sub',
                stationIndex: null,
                stationValid: false,
                customer: null,
                expiryDate: null,
                maxStations: null,
            };
        }
    }

    /**
     * Position (1-indexée) d'une machine dans la carte des sous-licences,
     * ou nombre de sous-licences si la machine n'y figure pas.
     */
    private computeStationIndex(subs: SubsMap, machineId: string): number {
        const machineIds = Object.keys(subs);
        const position = machineIds.indexOf(machineId);
        return position >= 0 ? position + 1 : machineIds.length;
    }
}
