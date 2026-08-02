import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
    generateKeyPair,
    signMaster,
    verifyMaster,
    signSub,
    verifySub,
    deriveSubPublicKey,
    parseToken,
    isExpired,
    daysRemaining,
    PUBLIC_KEY_HEX,
} from '../backend/services/licenseCrypto';
import type { MasterLicensePayload, ParsedLicense } from '../backend/services/licenseCrypto';

const PROJECT_KEY_DIR = path.resolve(__dirname, '..', '..', '.license-keys');
const KEY_DIR = PROJECT_KEY_DIR;
const DEFAULT_KEY_PATH = path.join(KEY_DIR, 'e-school-license.key');
const LEGACY_KEY_PATH = path.join(os.homedir(), '.e-school', 'e-school-license.key');
const PRIVATE_KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
const DAY_MS = 86_400_000;

function usage(): void {
    console.log(`CLI de gestion des licences E-SCHOOL (Ed25519 hors-ligne)

Usage :
  license:cli gen-keypair [--force]
      Génère la paire de clés vendeur dans ${DEFAULT_KEY_PATH}.
      Idempotent : refuse d'écraser une clé existante (utilisez --force
      pour régénérer ; l'ancienne clé est sauvegardée dans *.bak).
      Affiche la clé publique embarquée dans PUBLIC_KEY_HEX.
      Si la clé est absente du projet, le CLI retombe sur l'emplacement
      historique ${LEGACY_KEY_PATH}.

  license:cli gen-master --customer "Nom" --stations 3 --years 1 [--out master.txt]
      Génère une licence maître signée (3 postes, 1 an).
      Options : --key <chemin> ou variable d'environnement LICENSE_PRIVATE_KEY.
      Sans --stations, la licence est limitée à 1 poste (défaut).
      Sans --out, le jeton est imprimé sur la sortie standard.

  license:cli gen-sub --master master.txt --machine <empreinte> [--years 1] [--out sub.txt]
      Génère une sous-licence liée à une machine à partir d'une licence maître valide.
      Le résultat est un paquet de 2 lignes : le jeton de sous-licence puis la
      clé publique de vérification, à coller sur le poste cible (activation).
      Avec --out, le paquet est écrit dans le fichier (2 lignes).

  license:cli inspect <fichier> [--master master.txt]
      Parse et vérifie une licence (maître ou sous-licence).
      Accepte un fichier paquet de sous-licence (2 lignes : jeton + clé publique).
      --master permet la vérification cryptographique complète d'une sous-licence.

  license:cli help
      Affiche cette aide.`);
}

function fail(message: string): never {
    console.error(`Erreur : ${message}`);
    process.exit(1);
}

function parseArgs(args: string[]): { positionals: string[]; options: Map<string, string> } {
    const positionals: string[] = [];
    const options = new Map<string, string>();
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1];
            if (value === undefined || value.startsWith('--')) {
                fail(`L'option '--${key}' attend une valeur.`);
            }
            options.set(key, value);
            i += 1;
        } else {
            positionals.push(arg);
        }
    }
    return { positionals, options };
}

function readPrivateKeyFile(filePath: string): string {
    let content: string;
    try {
        content = fs.readFileSync(path.resolve(filePath), 'utf8');
    } catch {
        fail(`Clé privée introuvable : ${filePath}.`);
    }
    const privateKeyHex = content.trim();
    if (!PRIVATE_KEY_HEX_PATTERN.test(privateKeyHex)) {
        fail(`Clé privée invalide dans ${filePath} : 64 caractères hexadécimaux attendus.`);
    }
    return privateKeyHex;
}

function loadPrivateKey(explicitPath: string | undefined): string {
    if (explicitPath) {
        return readPrivateKeyFile(explicitPath);
    }
    const fromEnv = process.env['LICENSE_PRIVATE_KEY'];
    if (fromEnv && fromEnv.length > 0) {
        if (fs.existsSync(fromEnv)) {
            return readPrivateKeyFile(fromEnv);
        }
        if (!PRIVATE_KEY_HEX_PATTERN.test(fromEnv.trim())) {
            fail('Variable d\'environnement LICENSE_PRIVATE_KEY invalide : chemin inexistant ou clé hex mal formée.');
        }
        return fromEnv.trim();
    }
    if (fs.existsSync(DEFAULT_KEY_PATH)) {
        return readPrivateKeyFile(DEFAULT_KEY_PATH);
    }
    if (fs.existsSync(LEGACY_KEY_PATH)) {
        console.log(`Clé privée trouvée à l'emplacement historique : ${LEGACY_KEY_PATH}`);
        return readPrivateKeyFile(LEGACY_KEY_PATH);
    }
    fail(`Clé privée introuvable : ${DEFAULT_KEY_PATH}. Lancez d'abord 'license:cli gen-keypair'.`);
}

function readTokenFile(filePath: string): string {
    let content: string;
    try {
        content = fs.readFileSync(path.resolve(filePath), 'utf8');
    } catch {
        fail(`Fichier de licence introuvable : ${filePath}.`);
    }
    // Un paquet de sous-licence contient 2 lignes (jeton + clé publique) :
    // on ne retient que la première ligne non vide (le jeton).
    const token = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (token === undefined) {
        fail(`Fichier de licence vide : ${filePath}.`);
    }
    return token;
}

function writeOutput(token: string, outPath: string | undefined): void {
    if (outPath) {
        fs.writeFileSync(path.resolve(outPath), `${token}\n`);
        console.log(`Jeton écrit dans ${path.resolve(outPath)}`);
    } else {
        console.log(token);
    }
}

function requireOption(options: Map<string, string>, key: string): string {
    const value = options.get(key);
    if (value === undefined || value.length === 0) {
        fail(`Option obligatoire manquante : --${key}.`);
    }
    return value;
}

function parsePositiveInt(value: string | undefined, name: string, defaultValue: number): number {
    const raw = value ?? String(defaultValue);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        fail(`Valeur invalide pour --${name} : '${raw}' (entier positif attendu).`);
    }
    return parsed;
}

function addYears(isoDate: string, years: number): string {
    const date = new Date(isoDate);
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString();
}

function minIso(a: string, b: string): string {
    return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function randomHex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
}

function printExpiration(expiresAt: string): void {
    const remaining = daysRemaining(expiresAt);
    console.log(`  Expire le      : ${expiresAt}`);
    console.log(`  Jours restants : ${remaining === null ? 'EXPIRÉE' : String(remaining)}`);
}

function cmdGenKeypair(force: boolean): void {
    if (fs.existsSync(DEFAULT_KEY_PATH) && !force) {
        console.log(`Clé privée déjà présente : ${DEFAULT_KEY_PATH}`);
        console.log(`Clé publique embarquée dans PUBLIC_KEY_HEX : ${PUBLIC_KEY_HEX}`);
        console.log('Les licences sont signées avec cette clé : rien à faire.');
        console.log(`Pour régénérer (invalide les licences existantes) : 'license:cli gen-keypair --force'.`);
        return;
    }
    if (fs.existsSync(DEFAULT_KEY_PATH)) {
        const backupPath = `${DEFAULT_KEY_PATH}.bak`;
        fs.copyFileSync(DEFAULT_KEY_PATH, backupPath);
        console.log(`Ancienne clé sauvegardée : ${backupPath}`);
    }
    const pair = generateKeyPair();
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(DEFAULT_KEY_PATH, `${pair.privateKeyHex}\n`, { mode: 0o600 });
    console.log(`Nouvelle paire générée et écrite : ${DEFAULT_KEY_PATH} (permissions 600)`);
    console.log('');
    console.log('IMPORTANT : les licences signées avec l\'ancienne clé sont désormais invalides.');
    console.log(`Mettez à jour PUBLIC_KEY_HEX dans licenseCrypto.ts avec :`);
    console.log(pair.publicKeyHex);
    console.log(`(clé publique actuellement embarquée : ${PUBLIC_KEY_HEX})`);
}

function cmdGenMaster(options: Map<string, string>): void {
    const customer = requireOption(options, 'customer');
    const stationsRaw = options.get('stations');
    const stations = parsePositiveInt(stationsRaw, 'stations', 1);
    if (stationsRaw === undefined) {
        console.log('Remarque : --stations absent, licence limitée à 1 poste (défaut).');
    }
    const years = parsePositiveInt(options.get('years'), 'years', 1);
    const outPath = options.get('out');
    const privateKeyHex = loadPrivateKey(options.get('key'));

    const now = new Date().toISOString();
    const payload = {
        lid: `MST-${randomHex(4)}`,
        cust: customer,
        type: 'master' as const,
        maxStations: stations,
        seed: randomHex(32),
        issuedAt: now,
        expiresAt: addYears(now, years),
    };
    const token = signMaster(payload, privateKeyHex);

    writeOutput(token, outPath);
    console.log('');
    console.log('Licence maître générée et signée :');
    console.log(`  ID licence      : ${payload.lid}`);
    console.log(`  Client          : ${payload.cust}`);
    console.log(`  Postes max      : ${payload.maxStations}`);
    console.log(`  Émise le        : ${payload.issuedAt}`);
    printExpiration(payload.expiresAt);
}

function cmdGenSub(options: Map<string, string>): void {
    const masterFile = requireOption(options, 'master');
    const machineId = requireOption(options, 'machine');
    const years = parsePositiveInt(options.get('years'), 'years', 1);
    const outPath = options.get('out');

    const masterToken = readTokenFile(masterFile);
    let master: MasterLicensePayload;
    try {
        master = verifyMaster(masterToken);
    } catch (error) {
        fail(`Licence maître invalide : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
    if (isExpired(master)) {
        fail(`Licence maître expirée depuis le ${master.expiresAt}. Renouvelez la licence maître.`);
    }

    const now = new Date().toISOString();
    const payload = {
        lid: `SUB-${randomHex(4)}`,
        type: 'sub' as const,
        masterLid: master.lid,
        machineId,
        // Informations d'affichage recopiées de la maître pour le poste sub
        cust: master.cust,
        maxStations: master.maxStations,
        issuedAt: now,
        expiresAt: minIso(master.expiresAt, addYears(now, years)),
    };
    const token = signSub(payload, master.seed, machineId);
    // Clé publique de vérification dérivée du seed : seule cette clé (jamais le
    // seed) est fournie au poste cible, pour vérifier la sous-licence sans
    // permettre de forger d'autres sous-licences.
    const publicKeyHex = deriveSubPublicKey(master.seed, machineId);
    const packageText = `${token}\n${publicKeyHex}`;

    if (outPath) {
        fs.writeFileSync(path.resolve(outPath), `${packageText}\n`);
        console.log(`Paquet de sous-licence écrit dans ${path.resolve(outPath)} (2 lignes : jeton + clé publique).`);
    } else {
        console.log(packageText);
        console.log('');
        console.log('Paquet à coller sur le poste cible : le jeton (ligne 1) suivi d\'un saut');
        console.log('de ligne puis de la clé publique de vérification (ligne 2).');
    }

    console.log('');
    console.log('Sous-licence générée et signée :');
    console.log(`  ID sous-licence : ${payload.lid}`);
    console.log(`  Licence maître  : ${payload.masterLid}`);
    console.log(`  Machine liée    : ${payload.machineId}`);
    console.log(`  Client          : ${payload.cust}`);
    console.log(`  Postes max      : ${payload.maxStations}`);
    console.log(`  Émise le        : ${payload.issuedAt}`);
    printExpiration(payload.expiresAt);
}

function printParsedLicense(payload: ParsedLicense): void {
    console.log(JSON.stringify(payload, null, 2));
}

function cmdInspect(options: Map<string, string>, positionals: string[]): void {
    const filePath = positionals[0];
    if (!filePath) {
        fail('Usage : license:cli inspect <fichier> [--master master.txt]');
    }
    const token = readTokenFile(filePath);
    const masterFilePath = options.get('master');

    let parsed: ParsedLicense;
    try {
        parsed = parseToken(token);
    } catch (error) {
        fail(error instanceof Error ? error.message : 'Licence illisible.');
    }

    if (parsed.type === 'master') {
        try {
            verifyMaster(token);
        } catch (error) {
            console.log('Licence MAÎTRE INVALIDE :');
            printParsedLicense(parsed);
            fail(error instanceof Error ? error.message : 'Signature invalide.');
        }
        console.log('Licence MAÎTRE VALIDE :');
        printParsedLicense(parsed);
        if (isExpired(parsed)) {
            fail(`Licence maître expirée depuis le ${parsed.expiresAt}.`);
        }
        printExpiration(parsed.expiresAt);
        return;
    }

    if (masterFilePath) {
        const masterToken = readTokenFile(masterFilePath);
        let master: MasterLicensePayload;
        try {
            master = verifyMaster(masterToken);
        } catch (error) {
            fail(error instanceof Error ? error.message : 'Licence maître illisible.');
        }
        try {
            // Le poste principal dérive la clé publique depuis le seed : le poste
            // cible (ligne 2 du paquet) reçoit cette clé, jamais le seed.
            const publicKeyHex = deriveSubPublicKey(master.seed, parsed.machineId);
            verifySub(token, publicKeyHex, parsed.machineId);
        } catch (error) {
            console.log('SOUS-LICENCE INVALIDE :');
            printParsedLicense(parsed);
            fail(error instanceof Error ? error.message : 'Signature de sous-licence invalide.');
        }
        console.log('SOUS-LICENCE VALIDE (vérification cryptographique complète) :');
        printParsedLicense(parsed);
        if (isExpired(parsed)) {
            fail(`Sous-licence expirée depuis le ${parsed.expiresAt}.`);
        }
        printExpiration(parsed.expiresAt);
        return;
    }

    console.log('SOUS-LICENCE : structure valide (vérification cryptographique possible avec --master)');
    printParsedLicense(parsed);
    if (isExpired(parsed)) {
        fail(`Sous-licence expirée depuis le ${parsed.expiresAt}.`);
    }
    printExpiration(parsed.expiresAt);
}

function main(): void {
    const args = process.argv.slice(2);
    const [command, ...rest] = args;

    switch (command) {
        case 'gen-keypair': {
            const { options } = parseArgs(rest);
            cmdGenKeypair(options.has('force'));
            break;
        }
        case 'gen-master': {
            const { options } = parseArgs(rest);
            cmdGenMaster(options);
            break;
        }
        case 'gen-sub': {
            const { options } = parseArgs(rest);
            cmdGenSub(options);
            break;
        }
        case 'inspect': {
            const { positionals, options } = parseArgs(rest);
            cmdInspect(options, positionals);
            break;
        }
        case 'help':
            usage();
            break;
        case undefined:
            usage();
            break;
        default:
            fail(`Commande inconnue : '${command}'. Lancez 'license:cli help' pour l'aide.`);
    }
}

main();
