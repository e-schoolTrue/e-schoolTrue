import { machineIdSync } from 'node-machine-id';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { License } from '../entities/licence';
import { supabaseConfig } from '../../config/supabase';
import { AppDataSource } from '#electron/data-source';

export interface LicenseDetails {
    isValid: boolean;
    message: string;
    maxActivations?: number;
    currentActivations?: number;
    schoolName?: string;
    licenseType?: string;
    expiresAt?: string | null; // La date sera une chaîne ISO
  }

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
export class LicenseService {
    public async initializeLicenseTable(): Promise<void> {
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
    public generateMachineId(): string {
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
public async activateLicense(licenseCode: string): Promise<{ success: boolean; message?: string }> {
    const client = getSupabaseClient();
    const machineId = this.generateMachineId();

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

        // 🔽 Extraction complète avec remoteId
        const { id: remoteId, type, duration_days, activated_at: activatedAtStr } = activationResult;

        let expiresAt: Date | null = null;
        const activatedAt = new Date(activatedAtStr);

        if (duration_days !== null) {
            expiresAt = new Date(activatedAt);
            expiresAt.setDate(expiresAt.getDate() + duration_days);
        }

        const licenseRepository = connection.getRepository(License);

        try {
            await licenseRepository.delete({ machine_id: machineId });
        } catch (deleteError) {
            console.warn('[LicenseService] Erreur lors de la suppression de l\'ancienne licence:', deleteError);
        }

        const newLicense = new License();
        newLicense.remote_id = remoteId; // ✅ Ajout de l'ID distant
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
}



    public async getLicenseStatus(): Promise<{ 
        isValid: boolean; 
        daysRemaining: number | null;
        machineId?: string;
        licenseCode?: string;
        licenseType?: string;
        expiryDate?: string | null;
        activatedAt?: string;
    }> {
    const machineId = this.generateMachineId();

    try {
        const licenseRepository = AppDataSource.getInstance().getRepository(License);
        const license = await licenseRepository.findOneBy({ machine_id: machineId });

        if (!license) {
            return { 
                isValid: false, 
                daysRemaining: null,
                machineId 
            };
        }

        // Utiliser les méthodes utilitaires de l'entité License
        const isValid = !license.isExpired();
        const daysRemaining = license.getDaysRemaining();

        return { 
            isValid,
            daysRemaining,
            machineId: license.machine_id,
            licenseCode: license.code,
            licenseType: license.type,
            expiryDate: license.expires_at,
            activatedAt: license.activated_at
        };
    } catch (error) {
        console.error('[LicenseService] Erreur de vérification de licence :', error);
        return { 
            isValid: false, 
            daysRemaining: null,
            machineId 
        };
    }
};

public async generateSubLicense(): Promise<{ success: boolean; newCode?: string; message: string }> {
    const client = getSupabaseClient();
    const machineId = this.generateMachineId();

    // 1. Obtenir la licence locale pour récupérer le code mère
    const licenseRepository = AppDataSource.getInstance().getRepository(License);
    const masterLicense = await licenseRepository.findOneBy({ machine_id: machineId });

    if (!masterLicense) {
        return {
            success: false,
            message: "Aucune licence mère n'est activée sur cet ordinateur. Impossible de générer une sous-licence."
        };
    }

    // 2. Appeler la nouvelle fonction RPC sur Supabase
    try {
        const { data, error } = await client.rpc('generate_sub_license', {
            p_master_code: masterLicense.code,
            p_master_machine_id: machineId,
        });

        if (error) {
            console.error('[LicenseService] Erreur RPC generate_sub_license:', error);
            return { success: false, message: "Erreur serveur lors de la génération de la sous-licence." };
        }

        const result = data && data.length > 0 ? data[0] : null;

        if (!result || !result.success) {
            console.warn('[LicenseService] Échec de la génération de sous-licence:', result?.message);
            return { success: false, message: result?.message || 'Une erreur inconnue est survenue.' };
        }

        console.log('[LicenseService] Sous-licence générée avec succès:', result.new_code);
        return {
            success: true,
            newCode: result.new_code,
            message: result.message
        };

    } catch (err) {
        console.error('[LicenseService] Erreur critique lors de la génération de sous-licence:', err);
        return { success: false, message: 'Erreur de communication avec le serveur des licences.' };
    }
}

public async getLicenseDetails(): Promise<LicenseDetails> {
    const client = getSupabaseClient();
    const machineId = this.generateMachineId();

    try {
        // 1. Obtenir la licence locale pour avoir le code à vérifier
        const licenseRepository = AppDataSource.getInstance().getRepository(License);
        const localLicense = await licenseRepository.findOneBy({ machine_id: machineId });

        if (!localLicense) {
            return {
                isValid: false,
                message: 'Aucune licence n\'est activée sur cet ordinateur.'
            };
        }

        // 2. Appeler la nouvelle fonction RPC sur Supabase
        const { data, error } = await client.rpc('get_license_details', {
            p_code: localLicense.code,
        });

        if (error) {
            console.error('[LicenseService] Erreur RPC get_license_details:', error);
            return { isValid: false, message: 'Erreur serveur lors de la récupération des détails.' };
        }

        const details = data && data.length > 0 ? data[0] : null;

        if (!details || !details.is_valid) {
            return {
                isValid: false,
                message: details?.message || 'Impossible de valider la licence auprès du serveur.'
            };
        }

        // 3. Retourner un objet propre et bien typé
        return {
            isValid: true,
            message: details.message,
            maxActivations: details.max_activations,
            currentActivations: details.current_activations,
            schoolName: details.school_name,
            licenseType: details.license_type,
            expiresAt: details.expires_at,
        };

    } catch (err) {
        console.error('[LicenseService] Erreur critique lors de la récupération des détails:', err);
        return { isValid: false, message: 'Erreur de communication avec le serveur des licences.' };
    }
}

}