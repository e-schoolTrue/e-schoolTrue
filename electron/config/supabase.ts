// Créer un fichier de configuration pour Supabase
export const supabaseConfig = {
    url: process.env.VITE_SUPABASE_URL || 'https://zycgkwzhikvdmcfcawfm.supabase.cohttps://zycgkwzhikvdmcfcawfm.supabase.co',
    key: process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5Y2drd3poaWt2ZG1jZmNhd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMzA0MTUsImV4cCI6MjA1MDcwNjQxNX0.JzAeeNDnfk-gY1sHWPqaYHP6fIPOk6X8i4wQ9pxPSsU',
    bucket: 'backups', // Le nom de votre bucket pour les sauvegardes
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Erreur configuration');
}