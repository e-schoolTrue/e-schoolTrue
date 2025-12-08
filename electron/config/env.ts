import * as dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let envPath: string;

if (app.isPackaged) {
    // En mode packagé (production), chercher le fichier .env dans le dossier userData
    const userDataPath = app.getPath('userData');
    envPath = path.join(userDataPath, '.env');

    // Si le fichier n'existe pas, le créer avec un template
    if (!fs.existsSync(envPath)) {
        const template = `# Configuration Supabase
SUPABASE_URL=https://xebukndcynlvjpguwrcb.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYnVrbmRjeW5sdmpwZ3V3cmNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Njc0NDk4NywiZXhwIjoyMDYyMzIwOTg3fQ.0zfw4ZM_5SdqNgLzh9PnA4fTqA9IyKdZJRnKUDpyFTQ
GEMINI_API_KEY=AIzaSyD_fQ5PmD0eGq_cXPtiZFzTlg6c3vCcVVU
`;
        fs.writeFileSync(envPath, template);
        console.log(`[ENV] Fichier .env créé à : ${envPath}`);
    }
} else {
    // En mode développement, utiliser le chemin du projet
    const projectRoot = process.cwd();
    envPath = path.join(projectRoot, '.env');
    console.log(`[ENV] Mode développement détecté. Chemin du projet : ${projectRoot}`);
}

// Charger les variables d'environnement
dotenv.config({
    path: envPath,
    debug: process.env.NODE_ENV !== 'production'
});

console.log(`[ENV] Chemin du fichier .env : ${envPath}`);
console.log(`[ENV] SUPABASE_URL chargé : ${process.env.SUPABASE_URL ? 'Oui' : 'Non'}`);
console.log(`[ENV] SUPABASE_KEY chargé : ${process.env.SUPABASE_KEY ? 'Oui' : 'Non'}`);

// Exporter les variables d'environnement validées
export const ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};
// Valider les variables requises
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    const errorMessage = `Variables d'environnement manquantes. Veuillez configurer le fichier .env à l'emplacement : ${envPath}`;
    console.error(errorMessage);
    console.error('Variables requises : SUPABASE_URL, SUPABASE_KEY');
    throw new Error(errorMessage);
}

if (!ENV.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY manquante. Les fonctionnalités IA seront désactivées.');
}

