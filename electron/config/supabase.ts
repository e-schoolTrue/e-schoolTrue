// Créer un fichier de configuration pour Supabase
export const supabaseConfig = {
    url: process.env.SUPABASE_URL || 'votre_url_supabase',
    key: process.env.SUPABASE_KEY || 'votre_clé_supabase',
    bucket: 'backups', // Le nom de votre bucket pour les sauvegardes
}; 