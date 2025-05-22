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
SUPABASE_URL=votre_url_supabase
SUPABASE_KEY=votre_clé_supabase
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
};

// Valider les variables requises
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    const errorMessage = `Variables d'environnement manquantes. Veuillez configurer le fichier .env à l'emplacement : ${envPath}`;
    console.error(errorMessage);
    console.error('Variables requises : SUPABASE_URL, SUPABASE_KEY');
    throw new Error(errorMessage);
}
