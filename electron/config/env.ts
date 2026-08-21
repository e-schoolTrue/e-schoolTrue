import * as dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { randomBytes } from 'crypto';

let envPath: string;

if (app.isPackaged) {
    // En mode packagé (production), chercher le fichier .env dans le dossier userData
    const userDataPath = app.getPath('userData');
    envPath = path.join(userDataPath, '.env');

    // Si le fichier n'existe pas, le créer avec un template
    if (!fs.existsSync(envPath)) {
        const template = `# Configuration Supabase
# Décommentez et configurez ces valeurs pour activer les fonctionnalités cloud (synchronisation, sauvegarde, licence).
# SUPABASE_URL=votre_url_supabase
# SUPABASE_KEY=votre_cle_supabase
# GEMINI_API_KEY=votre_cle_gemini
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

// ---------------------------------------------------------------------------
// ENCRYPTION_KEY — génération stable et persistance
// ---------------------------------------------------------------------------
function ensureEncryptionKey(persistPath: string): string {
    const existing = process.env.ENCRYPTION_KEY;
    const isValid =
        typeof existing === 'string' &&
        existing.length >= 16 &&
        existing !== 'your-fallback-encryption-key';

    if (isValid) {
        console.log(`[ENV] ENCRYPTION_KEY chargé : Oui (len=${existing!.length})`);
        return existing!;
    }

    // Génère une clé stable 256-bit hex (32 bytes = 64 chars)
    const generated = randomBytes(32).toString('hex');

    try {
        let envContent = '';
        if (fs.existsSync(persistPath)) {
            envContent = fs.readFileSync(persistPath, 'utf8');
        }

        if (envContent.includes('ENCRYPTION_KEY=')) {
            // Remplace une valeur vide ou fallback existante
            const updated = envContent.replace(
                /^ENCRYPTION_KEY=.*$/m,
                `ENCRYPTION_KEY=${generated}`,
            );
            if (updated !== envContent) {
                fs.writeFileSync(persistPath, updated, 'utf8');
            }
        } else {
            // Append — préserve le contenu existant
            const prefix = envContent.length === 0 || envContent.endsWith('\n') ? '' : '\n';
            fs.appendFileSync(persistPath, `${prefix}ENCRYPTION_KEY=${generated}\n`, 'utf8');
        }

        console.log(`[ENV] ENCRYPTION_KEY générée et persistée à : ${persistPath}`);
    } catch (e) {
        console.error('[ENV] Impossible de persister ENCRYPTION_KEY, utilisation en mémoire uniquement:', e);
        // Fallback: tente persistence dans app-config.json (userData) si .env non inscriptible
        try {
            const fallbackPath = app.isPackaged
                ? path.join(app.getPath('userData'), 'app-config.json')
                : path.join(process.cwd(), 'app-config.json');
            let cfg: Record<string, unknown> = {};
            if (fs.existsSync(fallbackPath)) {
                try {
                    cfg = JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) as Record<string, unknown>;
                } catch { cfg = {}; }
            }
            cfg['ENCRYPTION_KEY'] = generated;
            fs.writeFileSync(fallbackPath, JSON.stringify(cfg, null, 2), 'utf8');
            console.log(`[ENV] ENCRYPTION_KEY persistée en fallback à : ${fallbackPath}`);
        } catch (fallbackErr) {
            console.error('[ENV] Fallback app-config.json échoué:', fallbackErr);
        }
    }

    process.env.ENCRYPTION_KEY = generated;
    console.log(`[ENV] ENCRYPTION_KEY chargée : Oui (générée, len=${generated.length})`);
    return generated;
}

ensureEncryptionKey(envPath);

// Exporter les variables d'environnement validées
export const ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
};
// Valider les variables requises
if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    console.warn('[ENV] Supabase non configuré. Les fonctionnalités cloud (synchronisation, licence cloud) seront désactivées.');
    console.warn(`[ENV] Pour activer le cloud, configurez SUPABASE_URL et SUPABASE_KEY dans : ${envPath}`);
    // Ne pas throw — supabase.ts a des credentials de fallback et tous les services gèrent le mode dégradé
}

if (!ENV.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY manquante. Les fonctionnalités IA seront désactivées.');
}

if (!ENV.ENCRYPTION_KEY || ENV.ENCRYPTION_KEY === 'your-fallback-encryption-key') {
    console.warn('[ENV] ENCRYPTION_KEY utilise le fallback — les données license.json restent chiffrées mais la clé n\'est pas persistée de façon sécurisée.');
}
