// Créer un fichier de configuration pour Supabase
export const supabaseConfig = {
    url: process.env.VITE_SUPABASE_URL || '',
    key: process.env.VITE_SUPABASE_KEY || '',
    bucket: 'backups', // Le nom de votre bucket pour les sauvegardes
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Configuration Supabase manquante. Veuillez configurer les variables d\'environnement.');
}