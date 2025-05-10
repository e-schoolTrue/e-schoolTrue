// Configuration pour Supabase
export const supabaseConfig = {
    url: 'https://xebukndcynlvjpguwrcb.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYnVrbmRjeW5sdmpwZ3V3cmNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Njc0NDk4NywiZXhwIjoyMDYyMzIwOTg3fQ.0zfw4ZM_5SdqNgLzh9PnA4fTqA9IyKdZJRnKUDpyFTQ',
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
    throw new Error('Configuration Supabase invalide');
}