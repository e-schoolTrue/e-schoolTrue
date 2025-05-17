import * as dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement au plus tôt
dotenv.config({
    path: path.resolve(process.cwd(), '.env')
});

// Exporter les variables d'environnement validées
export const ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
};

// Valider les variables requises
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    console.error('Variables d\'environnement manquantes. Veuillez vérifier votre fichier .env');
    console.error('Variables requises : SUPABASE_URL, SUPABASE_KEY');
}
