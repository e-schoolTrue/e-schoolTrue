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
 * Initialise la table de licence locale
 */
export const initializeLicenseTable = async (): Promise<void> => {
    try {
        const connection = AppDataSource.getInstance();
        await connection.synchronize(false); // false pour ne pas supprimer les tables existantes
        console.log('[LicenseService] Table de licence initialisée avec succès');
    } catch (error) {
        console.error('[LicenseService] Erreur lors de l\'initialisation de la table:', error);
        throw new Error('Impossible d\'initialiser la table de licence');
    }
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
export const activateLicense = async (licenseCode: string): Promise<{ success: boolean; message?: string }> => {
    const client = getSupabaseClient();
    const machineId = generateMachineId();

    try {
        // Vérifier que la base de données est initialisée
        const connection = AppDataSource.getInstance();
        if (!connection.isInitialized) {
            throw new Error('La base de données n\'est pas initialisée');
        }

        const { data, error } = await client.rpc('activate_license', {
            p_code: licenseCode,
            p_machine_id: machineId,
        });

        if (error) {
            console.error('[LicenseService] Erreur Supabase RPC:', error);
            return { success: false, message: 'Erreur lors de la vérification de la licence' };
        }

        const activationResult = data && data.length > 0 ? data[0] : null;

        if (!activationResult || !activationResult.code) {
            console.warn('[LicenseService] Code invalide ou réponse vide Supabase:', activationResult);
            return { success: false, message: 'Code de licence invalide' };
        }

        const { type, duration_days, activated_at: activatedAtStr } = activationResult;

        let expiresAt: Date | null = null;
        const activatedAt = new Date(activatedAtStr);

        if (duration_days !== null && duration_days !== undefined) {
            expiresAt = new Date(activatedAt);
            expiresAt.setDate(expiresAt.getDate() + duration_days);
        }

        const licenseRepository = connection.getRepository(License);

        // Supprimer toute ancienne licence dans un bloc try/catch séparé
        try {
            await licenseRepository.delete({ machine_id: machineId });
        } catch (deleteError) {
            console.warn('[LicenseService] Erreur lors de la suppression de l\'ancienne licence:', deleteError);
            // Continuer même si la suppression échoue
        }

        const newLicense = new License();
        newLicense.code = licenseCode;
        newLicense.type = type;
        newLicense.machine_id = machineId;
        newLicense.activated_at = activatedAt.toISOString();
        newLicense.expires_at = expiresAt ? expiresAt.toISOString() : null;

        await licenseRepository.save(newLicense);
        console.log('[LicenseService] Licence activée et enregistrée localement.');
        return { success: true, message: 'Licence activée avec succès' };

    } catch (error) {
        console.error('[LicenseService] Erreur critique:', error);
        return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Erreur inattendue lors de l\'activation'
        };
    }
};

/**
 * Vérifie la validité de la licence actuelle sur cette machine et retourne les détails
 */
export const getLicenseStatus = async (): Promise<{ isValid: boolean; daysRemaining: number | null }> => {
    const machineId = generateMachineId();

    try {
        const licenseRepository = AppDataSource.getInstance().getRepository(License);
        const license = await licenseRepository.findOneBy({ machine_id: machineId });

        if (!license) {
            return { isValid: false, daysRemaining: null };
        }

        if (license.expires_at === null) {
            return { isValid: true, daysRemaining: null }; // Licence à vie
        }

        const expiresAtDate = new Date(license.expires_at);
        const now = new Date();

        if (expiresAtDate > now) {
            const diffTime = Math.abs(expiresAtDate.getTime() - now.getTime());
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { isValid: true, daysRemaining };
        } else {
            return { isValid: false, daysRemaining: 0 };
        }
    } catch (error) {
        console.error('[LicenseService] Erreur de vérification de licence :', error);
        return { isValid: false, daysRemaining: null };
    }
};
