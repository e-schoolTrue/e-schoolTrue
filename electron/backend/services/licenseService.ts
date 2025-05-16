import { machineIdSync } from 'node-machine-id';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { License } from '../entities/licence';
import { supabaseConfig } from '../../config/supabase';
import { AppDataSource } from '#electron/data-source';

let supabase: SupabaseClient;

const getSupabaseClient = () => {
    if (!supabase) {
        supabase = createClient(supabaseConfig.url, supabaseConfig.key, supabaseConfig.options);
    }
    return supabase;
};

/**
 * Génère un identifiant unique pour la machine
 */
export const generateMachineId = (): string => {
    try {
        return machineIdSync(true);
    } catch (error) {
        console.error('[LicenseService] Erreur génération machine ID:', error);
        throw new Error('Impossible de générer un ID machine.');
    }
};

/**
 * Active une licence en contactant Supabase et en sauvegardant localement
 */
export const activateLicense = async (licenseCode: string): Promise<boolean> => {
    const client = getSupabaseClient();
    const machineId = generateMachineId();

    try {
        const { data, error } = await client.rpc('activate_license', {
            p_code: licenseCode,
            p_machine_id: machineId,
        });

        if (error) {
            console.error('[LicenseService] Erreur Supabase RPC:', error);
            return false;
        }

        const activationResult = data && data.length > 0 ? data[0] : null;

        if (!activationResult || !activationResult.code) {
            console.warn('[LicenseService] Code invalide ou réponse vide Supabase:', activationResult);
            return false;
        }

        const { type, duration_days, activated_at: activatedAtStr } = activationResult;

        let expiresAt: Date | null = null;
        const activatedAt = new Date(activatedAtStr);

        if (duration_days !== null && duration_days !== undefined) {
            expiresAt = new Date(activatedAt);
            expiresAt.setDate(expiresAt.getDate() + duration_days);
        }

        const licenseRepository = AppDataSource.getInstance().getRepository(License);

        // Supprimer toute ancienne licence
        await licenseRepository.delete({ machine_id: machineId });

        const newLicense = new License();
        newLicense.code = licenseCode;
        newLicense.type = type;
        newLicense.machine_id = machineId;
        newLicense.activated_at = activatedAt.toISOString();
        newLicense.expires_at = expiresAt ? expiresAt.toISOString() : null;

        await licenseRepository.save(newLicense);
        console.log('[LicenseService] Licence activée et enregistrée localement.');
        return true;

    } catch (dbError) {
        console.error('[LicenseService] Erreur DB locale:', dbError);
        return false;
    }
};

/**
 * Vérifie la validité de la licence actuelle sur cette machine
 */
export const isLicenseValid = async (): Promise<boolean> => {
    const machineId = generateMachineId();

    try {
        const licenseRepository = AppDataSource.getInstance().getRepository(License);
        const license = await licenseRepository.findOneBy({ machine_id: machineId });

        if (!license) {
            console.log('[LicenseService] Aucune licence trouvée localement.');
            return false;
        }

        if (license.expires_at === null) {
            console.log('[LicenseService] Licence à vie valide.');
            return true;
        }

        const expiresAtDate = new Date(license.expires_at);
        const now = new Date();

        if (expiresAtDate > now) {
            console.log('[LicenseService] Licence valide jusqu’au :', expiresAtDate.toISOString());
            return true;
        } else {
            console.log('[LicenseService] Licence expirée le :', expiresAtDate.toISOString());
            return false;
        }
    } catch (error) {
        console.error('[LicenseService] Erreur de vérification de licence :', error);
        return false;
    }
};
