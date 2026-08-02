// =============================================================================
// Tests de la logique métier du service de licence (licenseService.ts)
// =============================================================================
// La crypto (../licenseCrypto) est mockée : on teste le quota, le stockage et
// le statut, pas les signatures. Le stockage (../utils/electronStore) est
// mocké avec une classe in-memory partageant un Map, pour simuler le fichier
// ElectronStore entre les instances de service.
//
// Contrat après refonte :
//   - activateSub(packageText) attend un paquet multi-lignes « jeton + clé
//     publique dérivée » et ne stocke JAMAIS la maître sur un poste sub ;
//   - subKeys (machineId -> clé publique hex) accompagne subs (machineId ->
//     jeton) et sert à évaluer le statut d'un poste sub sans maître locale ;
//   - generateSub retourne le paquet « token\npubKey » et écrit subs + subKeys ;
//   - removeSub retire une sous-licence (poste principal uniquement).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LicenseService } from '../licenseService'
import {
    verifyMaster,
    verifySub,
    signSub,
    deriveSubPublicKey,
    isExpired,
    daysRemaining,
    buildMachineFingerprint,
} from '../licenseCrypto'
import type { MasterLicensePayload, SubLicensePayload } from '../licenseCrypto'

// --- Mocks de modules, hoistés avant tout import statique -------------------

/** État partagé du faux ElectronStore (simule le fichier 'license.json'). */
const storeState = vi.hoisted(() => new Map<string, string>())

vi.mock('../../utils/electronStore', () => {
    class InMemoryElectronStore {
        async getItem(key: string): Promise<string | null> {
            return storeState.get(key) ?? null;
        }
        async setItem(key: string, value: string): Promise<void> {
            storeState.set(key, value);
        }
        async removeItem(key: string): Promise<void> {
            storeState.delete(key);
        }
    }
    return { ElectronStore: InMemoryElectronStore };
})

vi.mock('../licenseCrypto', () => ({
    buildMachineFingerprint: vi.fn(),
    verifyMaster: vi.fn(),
    verifySub: vi.fn(),
    signSub: vi.fn(),
    deriveSubPublicKey: vi.fn((_seed: string, machineId: string) => `pub:${machineId}`),
    isExpired: vi.fn(),
    daysRemaining: vi.fn(),
}))

// --- Données de test ---------------------------------------------------------

const MACHINE_MASTER = 'machine-A';
const MACHINE_SUB = 'machine-B';

const masterPayload: MasterLicensePayload = {
    v: 1,
    kid: 'E-SCHOOL',
    lid: 'MST-TEST-0001',
    cust: 'École Test',
    type: 'master',
    maxStations: 3,
    seed: 'a'.repeat(64),
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2030-01-01T00:00:00.000Z',
};

/** Sous-licence valide : cust/maxStations recopiés de la maître (post-refonte). */
const subPayload: SubLicensePayload = {
    v: 1,
    kid: 'E-SCHOOL',
    lid: 'SUB-TEST-0001',
    type: 'sub',
    masterLid: 'MST-TEST-0001',
    machineId: MACHINE_SUB,
    cust: 'École Test',
    maxStations: 3,
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2029-01-01T00:00:00.000Z',
};

/** Lecture typée du contenu de la carte des sous-licences. */
function readSubs(): Record<string, string> {
    return JSON.parse(storeState.get('subs') ?? '{}') as Record<string, string>;
}

/** Lecture typée du contenu de la carte des clés publiques de sous-licences. */
function readSubKeys(): Record<string, string> {
    return JSON.parse(storeState.get('subKeys') ?? '{}') as Record<string, string>;
}

/** Installe un poste principal activé (maître + masterMachine). */
function installMasterStation(): void {
    storeState.set('master', 'MASTER-TOKEN');
    storeState.set('masterMachine', MACHINE_MASTER);
}

describe('LicenseService (logique métier, crypto mockée)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.clear();

        // Silence du bruit console du service
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Valeurs par défaut contrôlables de la crypto
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_MASTER);
        vi.mocked(verifyMaster).mockReturnValue(masterPayload);
        vi.mocked(verifySub).mockReturnValue(subPayload);
        vi.mocked(signSub).mockReturnValue('SUB-TOKEN-1');
        vi.mocked(deriveSubPublicKey).mockImplementation(
            (_seed: string, machineId: string) => `pub:${machineId}`
        );
        vi.mocked(isExpired).mockReturnValue(false);
        vi.mocked(daysRemaining).mockReturnValue(365);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('1. getStatus sans licence maître → isValid false, licenseType null', async () => {
        const service = new LicenseService();

        const result = await service.getStatus();

        expect(result.success).toBe(true);
        expect(result.data.isValid).toBe(false);
        expect(result.data.licenseType).toBeNull();
        expect(result.data.machineId).toBe(MACHINE_MASTER);
        expect(result.data.maxStations).toBeNull();
        expect(result.data.clockError).toBeUndefined();
        // Pas de maître → retour anticipé avant l'horloge : clockLastSeen non écrit
        expect(storeState.has('clockLastSeen')).toBe(false);
        expect(vi.mocked(verifyMaster)).not.toHaveBeenCalled();
    });

    it('2. activateMaster valide → succès ; getStatus sur le poste maître → master, stationIndex 1', async () => {
        const service = new LicenseService();

        const activation = await service.activateMaster('MASTER-TOKEN');

        expect(activation.success).toBe(true);
        expect(activation.data?.licenseType).toBe('master');
        expect(vi.mocked(verifyMaster)).toHaveBeenCalledWith('MASTER-TOKEN');
        expect(storeState.get('master')).toBe('MASTER-TOKEN');
        expect(storeState.get('masterMachine')).toBe(MACHINE_MASTER);

        const status = await service.getStatus();

        expect(status.data.isValid).toBe(true);
        expect(status.data.licenseType).toBe('master');
        expect(status.data.stationIndex).toBe(1);
        expect(status.data.customer).toBe('École Test');
        expect(status.data.maxStations).toBe(3);
        expect(status.data.daysRemaining).toBe(365);
        expect(storeState.has('clockLastSeen')).toBe(true);
    });

    it('3. activateMaster avec code invalide → échec avec message, rien stocké', async () => {
        vi.mocked(verifyMaster).mockImplementation(() => {
            throw new Error("Signature invalide : la licence a été falsifiée ou provient d'une autre clé.");
        });
        const service = new LicenseService();

        const result = await service.activateMaster('BAD-TOKEN');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Signature invalide');
        expect(storeState.has('master')).toBe(false);
        expect(storeState.has('masterMachine')).toBe(false);
    });

    it('4. ré-activer une maître purge subs et subKeys (quota fantôme)', async () => {
        installMasterStation();
        storeState.set('subs', JSON.stringify({ 'machine-B': 'SUB-B' }));
        storeState.set('subKeys', JSON.stringify({ 'machine-B': 'pub:machine-B' }));
        const service = new LicenseService();

        const result = await service.activateMaster('MASTER-TOKEN-2');

        expect(result.success).toBe(true);
        // Les sous-licences de l'ancien seed sont invalides : purgées avant l'écriture
        expect(storeState.has('subs')).toBe(false);
        expect(storeState.has('subKeys')).toBe(false);
        expect(storeState.get('master')).toBe('MASTER-TOKEN-2');
    });

    it('5. generateSub sur le poste maître → succès, paquet token\\npub, subs + subKeys stockés', async () => {
        installMasterStation();
        const service = new LicenseService();

        const result = await service.generateSub(MACHINE_SUB);

        expect(result.success).toBe(true);
        // Le paquet est « jeton + clé publique dérivée » (jamais le seed)
        expect(result.data?.subLicenseCode).toBe('SUB-TOKEN-1\npub:machine-B');
        expect(vi.mocked(signSub)).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'sub',
                masterLid: masterPayload.lid,
                machineId: MACHINE_SUB,
                cust: masterPayload.cust,
                maxStations: masterPayload.maxStations,
            }),
            masterPayload.seed,
            MACHINE_SUB,
        );
        expect(vi.mocked(deriveSubPublicKey)).toHaveBeenCalledWith(masterPayload.seed, MACHINE_SUB);
        expect(readSubs()[MACHINE_SUB]).toBe('SUB-TOKEN-1');
        expect(readSubKeys()[MACHINE_SUB]).toBe('pub:machine-B');

        // Sans cible : la sous-licence est générée pour la machine courante
        const resultForCurrent = await service.generateSub();
        expect(resultForCurrent.success).toBe(true);
        expect(vi.mocked(signSub)).toHaveBeenLastCalledWith(
            expect.objectContaining({ machineId: MACHINE_MASTER, cust: 'École Test', maxStations: 3 }),
            masterPayload.seed,
            MACHINE_MASTER,
        );
        expect(readSubKeys()[MACHINE_MASTER]).toBe('pub:machine-A');
    });

    it('6. generateSub depuis un poste non maître → refus « Seul le poste principal … »', async () => {
        installMasterStation();
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const service = new LicenseService();

        const result = await service.generateSub('machine-C');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Seul le poste principal peut générer des sous-licences.');
        expect(vi.mocked(signSub)).not.toHaveBeenCalled();
        expect(storeState.has('subs')).toBe(false);
    });

    it('7. quota : maxStations=3, 2 sous-licences existantes → 3e refusée, remplacement OK', async () => {
        installMasterStation();
        storeState.set('subs', JSON.stringify({ 'machine-B': 'SUB-B', 'machine-C': 'SUB-C' }));
        storeState.set('subKeys', JSON.stringify({ 'machine-B': 'pub:machine-B', 'machine-C': 'pub:machine-C' }));
        const service = new LicenseService();

        // Le poste maître compte pour 1 : 1 + 2 sous-licences = 3 = max → plus de place
        const denied = await service.generateSub('machine-D');

        expect(denied.success).toBe(false);
        expect(denied.message).toContain('Limite de postes atteinte');
        expect(vi.mocked(signSub)).not.toHaveBeenCalled();
        expect(storeState.has('subKeys')).toBe(true); // aucune écriture de subKeys

        // Régénérer une sous-licence pour une machine déjà présente → remplacement, pas d'incrément
        const replaced = await service.generateSub('machine-B');

        expect(replaced.success).toBe(true);
        const subs = readSubs();
        expect(subs['machine-B']).toBe('SUB-TOKEN-1');
        expect(Object.keys(subs)).toHaveLength(2);
        expect(readSubKeys()['machine-B']).toBe('pub:machine-B');
    });

    it('8. activateSub : paquet complet (2 lignes) sur un poste non maître → succès, maître jamais stockée', async () => {
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const service = new LicenseService();

        const ok = await service.activateSub('SUB-TOKEN-B\npub:machine-B');

        expect(ok.success).toBe(true);
        expect(ok.data?.licenseType).toBe('sub');
        // Vérification contre la clé publique du paquet (jamais le seed maître)
        expect(vi.mocked(verifySub)).toHaveBeenCalledWith('SUB-TOKEN-B', 'pub:machine-B', MACHINE_SUB);
        expect(readSubs()[MACHINE_SUB]).toBe('SUB-TOKEN-B');
        expect(readSubKeys()[MACHINE_SUB]).toBe('pub:machine-B');
        // La maître (qui contient le seed) n'est JAMAIS écrite sur un poste sub
        expect(storeState.has('master')).toBe(false);
        expect(storeState.has('masterMachine')).toBe(false);

        // Sous-licence invalide pour cette machine → échec avec le message de la crypto
        vi.mocked(verifySub).mockImplementation(() => {
            throw new Error("Sous-licence invalide : l'identifiant machine du jeton ne correspond pas à la machine demandée.");
        });
        const failed = await service.activateSub('SUB-BAD\npub:machine-B');

        expect(failed.success).toBe(false);
        expect(failed.message).toContain('Sous-licence invalide');
        expect(readSubs()[MACHINE_SUB]).toBe('SUB-TOKEN-B'); // pas d'écriture sur échec
    });

    it('9. activateSub : jeton seul (1 ligne) sur un poste non maître → échec « Paquet de sous-licence incomplet »', async () => {
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const service = new LicenseService();

        const result = await service.activateSub('SUB-TOKEN-SEUL');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Paquet de sous-licence incomplet');
        expect(vi.mocked(verifySub)).not.toHaveBeenCalled();
        expect(storeState.has('subs')).toBe(false);
        expect(storeState.has('subKeys')).toBe(false);
    });

    it('10. activateSub sur le poste maître → refus « déjà le poste principal »', async () => {
        installMasterStation();
        const service = new LicenseService();

        const result = await service.activateSub('SUB-CODE\npub:machine-A');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Ce poste est déjà le poste principal de la licence.');
        expect(storeState.has('subs')).toBe(false);
        expect(storeState.has('subKeys')).toBe(false);
    });

    it('11. getStatus sur un poste sous-licencié (subs + subKeys) → isValid true, licenseType sub', async () => {
        storeState.set('subs', JSON.stringify({ [MACHINE_SUB]: 'SUB-B' }));
        storeState.set('subKeys', JSON.stringify({ [MACHINE_SUB]: 'pub:machine-B' }));
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const service = new LicenseService();

        const status = await service.getStatus();

        expect(status.data.isValid).toBe(true);
        expect(status.data.licenseType).toBe('sub');
        expect(status.data.stationIndex).toBe(1);
        // customer/maxStations lus depuis le payload de la sous-licence (jamais la maître)
        expect(status.data.customer).toBe(subPayload.cust);
        expect(status.data.maxStations).toBe(subPayload.maxStations);
        expect(status.data.expiryDate).toBe(subPayload.expiresAt);
        expect(status.data.daysRemaining).toBe(365);
        expect(vi.mocked(verifySub)).toHaveBeenCalledWith('SUB-B', 'pub:machine-B', MACHINE_SUB);
    });

    it('12. getDetails : maître usedStations = subs + 1 ; poste sub usedStations = 1', async () => {
        installMasterStation();
        storeState.set('subs', JSON.stringify({ 'machine-B': 'SUB-B', 'machine-C': 'SUB-C' }));
        storeState.set('subKeys', JSON.stringify({ 'machine-B': 'pub:machine-B', 'machine-C': 'pub:machine-C' }));

        // Sur le poste maître : 2 sous-licences + 1 poste maître
        const masterDetails = await new LicenseService().getDetails();
        expect(masterDetails.data.usedStations).toBe(3);
        expect(masterDetails.data.maxStations).toBe(3);
        expect(masterDetails.data.licenseType).toBe('master');
        expect(masterDetails.data.isValid).toBe(true);

        // Sur un poste sous-licencié : le poste courant est le seul poste visible
        // (le nouveau design ne stocke jamais la maître sur un poste sub).
        storeState.clear();
        storeState.set('subs', JSON.stringify({ [MACHINE_SUB]: 'SUB-B' }));
        storeState.set('subKeys', JSON.stringify({ [MACHINE_SUB]: 'pub:machine-B' }));
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const subDetails = await new LicenseService().getDetails();
        expect(subDetails.data.usedStations).toBe(1);
        expect(subDetails.data.licenseType).toBe('sub');
        expect(subDetails.data.maxStations).toBe(subPayload.maxStations);
    });

    it('13. anti-rollback : clockLastSeen dans le futur → isValid false + clockError, horloge non mise à jour', async () => {
        installMasterStation();
        const futureClock = String(Date.now() + 10 * 60 * 1000);
        storeState.set('clockLastSeen', futureClock);
        const service = new LicenseService();

        const status = await service.getStatus();

        expect(status.data.isValid).toBe(false);
        expect(status.data.clockError).toBe(true);
        expect(status.data.licenseType).toBe('master'); // le type est conservé dans la réponse
        expect(status.message).toContain('horloge');
        // clockLastSeen n'est PAS mis à jour (aucune écriture)
        expect(storeState.get('clockLastSeen')).toBe(futureClock);
    });

    it('14a. removeSub : le poste maître retire une sous-licence → succès, subs + subKeys nettoyés', async () => {
        installMasterStation();
        storeState.set('subs', JSON.stringify({ 'machine-B': 'SUB-B', 'machine-C': 'SUB-C' }));
        storeState.set('subKeys', JSON.stringify({ 'machine-B': 'pub:machine-B', 'machine-C': 'pub:machine-C' }));
        const service = new LicenseService();

        const result = await service.removeSub('machine-B');

        expect(result.success).toBe(true);
        expect(readSubs()).toEqual({ 'machine-C': 'SUB-C' });
        expect(readSubKeys()).toEqual({ 'machine-C': 'pub:machine-C' });
    });

    it('14b. removeSub depuis un poste non maître → échec « Seul le poste principal »', async () => {
        installMasterStation();
        storeState.set('subs', JSON.stringify({ 'machine-B': 'SUB-B' }));
        vi.mocked(buildMachineFingerprint).mockReturnValue(MACHINE_SUB);
        const service = new LicenseService();

        const result = await service.removeSub('machine-B');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Seul le poste principal peut retirer une sous-licence.');
        expect(readSubs()).toEqual({ 'machine-B': 'SUB-B' }); // rien modifié
    });

    it('14c. removeSub avec une machine absente → échec « Aucune sous-licence »', async () => {
        installMasterStation();
        const service = new LicenseService();

        const result = await service.removeSub('machine-inconnue');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Aucune sous-licence pour ce poste.');
    });
});
