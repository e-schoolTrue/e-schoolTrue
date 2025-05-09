// Configuration pour Supabase
export const supabaseConfig = {
    url: process.env.VITE_SUPABASE_URL || 'https://xebukndcynlvjpguwrcb.supabase.co',
    key: process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYnVrbmRjeW5sdmpwZ3V3cmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NDQ5ODcsImV4cCI6MjA2MjMyMDk4N30.N6avpTRmQ-OPAoLuWviaKJVMJ7Eq-Q7j5sjDY04tEVE',
    bucket: 'backups', // Le nom de votre bucket pour les sauvegardes
}; 

// Validation de la configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    console.error('Erreur: Configuration Supabase manquante');
    throw new Error('Configuration Supabase invalide');
}