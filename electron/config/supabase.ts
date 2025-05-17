import { ENV } from './env';

// Configuration pour Supabase
export const supabaseConfig = {
    url: ENV.SUPABASE_URL,
    key: ENV.SUPABASE_KEY,
    bucket: 'school', // Le nom de votre bucket pour les sauvegardes
    options: {
        auth: {
            persistSession: false,
            autoRefreshToken: true,
            detectSessionInUrl: false
        },
        db: {
            schema: 'public' as const
        },
        global: {
            headers: {
                'x-application-name': 'e-school'
            }
        }
    }
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Erreur: Configuration Supabase manquante');
    throw new Error('Configuration Supabase invalide - Veuillez configurer les variables d\'environnement SUPABASE_URL et SUPABASE_KEY');
}