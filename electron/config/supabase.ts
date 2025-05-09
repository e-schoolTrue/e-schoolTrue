// Créer un fichier de configuration pour Supabase
export const supabaseConfig = {
    url: process.env.VITE_SUPABASE_URL,
    // Utiliser la clé service_role pour avoir plus de privilèges (nécessaire pour créer des buckets)
    // ATTENTION: Remplacez cette clé par votre propre clé service_role depuis le tableau de bord Supabase
    // Settings > API > service_role key
    key: process.env.VITE_SUPABASE_KEY,
    bucket: 'school', // Le nom de votre bucket pour les sauvegardes
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Erreur configuration');
}