// onfiguration pour Supabase
export const supabaseConfig = {
    url: process.env.VITE_SUPABASE_URL,
  
    key: process.env.VITE_SUPABASE_KEY,
    bucket: 'school', // Le nom de votre bucket pour les sauvegardes
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Erreur configuration');
}