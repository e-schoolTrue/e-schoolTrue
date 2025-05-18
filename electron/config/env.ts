import * as dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';

let envPath: string;

if (app.isPackaged) {
    // En mode packagé (production), chercher le fichier .env à côté de l'exécutable
    const exeDir = path.dirname(app.getPath('exe'));
    envPath = path.resolve(exeDir, '.env');
    console.log(`[ENV] Mode packagé détecté. Chemin de l'exécutable : ${exeDir}`);
} else {
    // En mode développement, chercher à la racine du projet relatif à __dirname
    // __dirname dans ce contexte est electron/config/
    envPath = path.resolve(__dirname, '../../../.env');
}

// Charger les variables d'environnement au plus tôt
dotenv.config({
    path: envPath,
    // Décommentez la ligne suivante pour un débogage détaillé du chargement de dotenv
    // debug: process.env.NODE_ENV !== 'production' 
});
console.log(`[ENV] Chemin du fichier .env tenté : ${envPath}`);
console.log(`[ENV] SUPABASE_URL chargé : ${process.env.SUPABASE_URL ? 'Oui' : 'Non'}`);
console.log(`[ENV] SUPABASE_KEY chargé : ${process.env.SUPABASE_KEY ? 'Oui' : 'Non'}`);

// Exporter les variables d'environnement validées
export const ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
};
console.log(`[ENV] Valeur de ENV.SUPABASE_URL: ${ENV.SUPABASE_URL}`);
console.log(`[ENV] Valeur de ENV.SUPABASE_KEY: ${ENV.SUPABASE_KEY}`);

// Valider les variables requises
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    console.error(`Variables d'environnement manquantes. Veuillez vérifier votre fichier .env. Chemin tenté : ${envPath}`);
    console.error('Variables requises : SUPABASE_URL, SUPABASE_KEY');
  
}
