import { UserEntity } from '../entities/user';
import { ResultType, ROLE } from '#electron/command';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../../data-source';
import Store from 'electron-store';
import { supabaseConfig } from '../../config/supabase';
import { supabase } from '../lib/supabaseClient';
import { setCurrentSupabaseUserId } from '../lib/session';
import { clearSchemaClients } from '../lib/supabaseClient';

//Variable globale pour stocker l'ID Supabase
let currentSupabaseUserId: string | null = null;

//Fonction exportée pour accéder à l'ID depuis d'autres modules
export function getCurrentSupabaseUserId(): string | null {
    return currentSupabaseUserId;
}

export class AuthService {
    private userRepository = AppDataSource.getInstance().getRepository(UserEntity);
    private currentUser: { id: number; username: string; displayName?: string | null; role?: ROLE; isActive?: boolean } | null = null;
    private store = new Store();
    private supabase = supabase;

    async createSupervisor(username: string, password: string, securityQuestion: string, securityAnswer: string): Promise<ResultType> {
        try {
            const existingSupervisor = await this.userRepository.findOne({ where: { username } });
            if (existingSupervisor) {
                return {
                    success: false,
                    data: null,
                    message: "Un utilisateur avec ce nom existe déjà",
                    error: "USERNAME_EXISTS"
                };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase(), salt);

            const supervisor = this.userRepository.create({
                username,
                password: hashedPassword,
                role: ROLE.admin,
                securityQuestion,
                securityAnswer: hashedAnswer
            });

            await this.userRepository.save(supervisor);

            return {
                success: true,
                data: {
                    id: supervisor.id,
                    username: supervisor.username
                },
                message: "Superviseur créé avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la création du superviseur:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du superviseur",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async validateSupervisor(username: string, password: string): Promise<ResultType> {
        try {
            console.log("=== Validation du superviseur ===");
            const user = await this.userRepository.findOne({ where: { username } });

            if (!user) {
                this.currentUser = null;
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                this.currentUser = null;
                return {
                    success: false,
                    data: null,
                    message: "Mot de passe incorrect",
                    error: "INVALID_PASSWORD"
                };
            }

            if (user.isActive === false) {
                this.currentUser = null;
                return {
                    success: false,
                    data: null,
                    message: "Compte désactivé. Contactez l'administrateur.",
                    error: "ACCOUNT_DISABLED"
                };
            }

            this.currentUser = {
                id: user.id,
                username: user.username,
                displayName: user.displayName ?? null,
                role: user.role,
                isActive: true
            };
            user.lastLoginAt = new Date();
            await this.userRepository.save(user);
            this.store.set('currentUser', { ...this.currentUser });

            console.log("=== Résultat de la validation ===", this.currentUser);

            return {
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName ?? null,
                    role: user.role,
                    isActive: true
                },
                message: "Connexion réussie",
                error: null
            };
        } catch (error) {
            console.error("Erreur validation:", error);
            this.currentUser = null;
            return {
                success: false,
                data: null,
                message: "Erreur lors de la validation",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async init() {
        // Restauration tolérante de la session locale (alignée sur AppUser src/types/user.ts
        // + userStore.hydrate() : id number, username non vide, role valide).
        // - id : number entier OU string numérique normalisée en number (legacy electron-store).
        // - role : doit appartenir à ['admin','professor','student','comptable']
        //   (ROLE dans #electron/command + UserRole dans src/types/user.ts).
        // - displayName : string ?? null. isActive : boolean ?? true.
        // - Ne purge le store que si la valeur est irrécupérable (objet invalide).
        const VALID_ROLES: string[] = ['admin', 'professor', 'student', 'comptable'];
        const stored = this.store.get('currentUser') as unknown as {
            id?: unknown; username?: unknown; displayName?: unknown; role?: unknown; isActive?: unknown;
        } | null | undefined;
        const purgeStored = () => {
            try { this.store.delete('currentUser'); } catch { /* best-effort purge */ }
        };
        let restored = false;
        if (stored !== null && stored !== undefined && typeof stored === 'object') {
            // Normalisation de l'id : number entier ou string numérique ("7" -> 7).
            let normalizedId: number | null = null;
            const rawId = (stored as { id?: unknown }).id;
            if (typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0) {
                normalizedId = rawId;
            } else if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) {
                const parsed = Number.parseInt(rawId.trim(), 10);
                if (Number.isInteger(parsed) && parsed > 0) normalizedId = parsed;
            }
            const rawUsername = (stored as { username?: unknown }).username;
            const normalizedUsername = typeof rawUsername === 'string' ? rawUsername.trim() : '';
            const rawRole = (stored as { role?: unknown }).role;
            const normalizedRole = typeof rawRole === 'string' ? rawRole.trim() : '';
            const rawDisplayName = (stored as { displayName?: unknown }).displayName;
            const rawIsActive = (stored as { isActive?: unknown }).isActive;
            if (normalizedId !== null && normalizedUsername.length > 0 && VALID_ROLES.includes(normalizedRole)) {
                this.currentUser = {
                    id: normalizedId,
                    username: normalizedUsername,
                    displayName: typeof rawDisplayName === 'string' ? rawDisplayName : null,
                    role: normalizedRole as ROLE,
                    isActive: typeof rawIsActive === 'boolean' ? rawIsActive : true,
                };
                restored = true;
                // Auto-réparation : réécrire la forme normalisée (id number) pour les prochains restarts.
                try { this.store.set('currentUser', { ...this.currentUser }); } catch { /* best-effort */ }
            } else {
                this.currentUser = null;
                purgeStored();
            }
        } else {
            this.currentUser = null;
            if (stored !== null && stored !== undefined) {
                purgeStored();
            }
        }
        void restored;

        // ✅ Étape 1.5 : Restauration best-effort de l'ID Supabase au démarrage.
        // Ne doit jamais faire échouer le démarrage (offline, tokens absents, etc.).
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (user) {
                currentSupabaseUserId = user.id;
                console.log('[AuthService:init] Session Supabase valide. ID restauré.');
            } else {
                currentSupabaseUserId = null;
            }
        } catch {
            currentSupabaseUserId = null;
        }
    }

    async getCurrentUser(): Promise<{ id: number; username: string; displayName?: string | null; role?: ROLE; isActive?: boolean } | null> {
        return this.currentUser;
    }

    async logout(): Promise<void> {
        this.currentUser = null;
        // Purge persistée : sans ceci, init() restaurerait currentUser au restart (ghost login).
        try {
            this.store.delete('currentUser');
        } catch (error) {
            console.warn('[AuthService:logout] store.delete(currentUser) failed:', error);
        }
    }

    async getSecurityQuestion(username: string): Promise<ResultType> {
        try {
            const user = await this.userRepository.findOne({ where: { username } });

            if (!user) {
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            return {
                success: true,
                data: {
                    question: user.securityQuestion
                },
                message: "Question de sécurité récupérée",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la récupération de la question de sécurité:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la question",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async validateSecurityAnswer(username: string, answer: string): Promise<ResultType> {
        try {
            const user = await this.userRepository.findOne({ where: { username } });

            if (!user) {
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            const isValid = await bcrypt.compare(answer.toLowerCase(), user.securityAnswer);
            if (!isValid) {
                return {
                    success: false,
                    data: null,
                    message: "Réponse incorrecte",
                    error: "INVALID_ANSWER"
                };
            }

            return {
                success: true,
                data: {
                    username: user.username
                },
                message: "Réponse validée",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la validation de la réponse:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la validation",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async resetPassword(username: string, newPassword: string): Promise<ResultType> {
        try {
            const user = await this.userRepository.findOne({ where: { username } });

            if (!user) {
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            user.password = hashedPassword;
            await this.userRepository.save(user);

            return {
                success: true,
                data: {
                    username: user.username
                },
                message: "Mot de passe mis à jour avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la réinitialisation du mot de passe:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la réinitialisation",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async createSupabaseAccount(email: string, password: string): Promise<ResultType> {
        try {
            const urlTest = new URL(supabaseConfig.url);
            try {
                await fetch(`${urlTest.origin}/health`);
            } catch (networkError) {
                console.error('Erreur connexion Supabase:', networkError);
                return {
                    success: false,
                    data: null,
                    message: "Impossible de se connecter au serveur Supabase",
                    error: "CONNECTION_ERROR"
                };
            }

            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        school_id: this.store.get('schoolId')
                    }
                }
            });

            if (error) {
                console.error('Erreur création compte Supabase:', error);
                return {
                    success: false,
                    data: null,
                    message: "Échec de la création du compte cloud",
                    error: this.formatSupabaseError(error)
                };
            }

            return {
                success: true,
                data: data.user,
                message: "Compte cloud créé avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur inattendue:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du compte cloud",
                error: this.formatError(error)
            };
        }
    }

    async signInWithSupabase(email: string, password: string): Promise<ResultType> {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            

            if (error) {
                console.error('Erreur connexion Supabase:', error);
                currentSupabaseUserId = null;
                return {
                    success: false,
                    data: null,
                    message: "Échec de la connexion au compte cloud",
                    error: error.message
                };

            }

            if (data.user) {
                currentSupabaseUserId = data.user.id;
                setCurrentSupabaseUserId(data.user.id);
                console.log(`[AuthService] Utilisateur Supabase connecté. ID stocké : ${currentSupabaseUserId}`);
            }
            else {
                setCurrentSupabaseUserId(null);
            }

            this.store.set('supabaseUser', {
                id: data.user?.id,
                email: data.user?.email,
                session: data.session
            });

            return {
                success: true,
                data: data.user,
                message: "Connexion au compte cloud réussie",
                error: null
            };
        } catch (error) {
            console.error('Erreur inattendue:', error);
            currentSupabaseUserId = null;
            return {
                success: false,
                data: null,
                message: "Erreur lors de la connexion au compte cloud",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async signOutFromSupabase(): Promise<void> {
        try {
            await this.supabase.auth.signOut();
        } catch (error) {
            // Offline / réseau : on purge quand même le local (best-effort signOut).
            console.warn('[AuthService] signOut Supabase a échoué (purge locale quand même):', error);
        } finally {
            currentSupabaseUserId = null;
            try {
                setCurrentSupabaseUserId(null); // reset session.ts (userId + schemaName)
            } catch (error) {
                console.warn('[AuthService] setCurrentSupabaseUserId(null) failed:', error);
            }
            try {
                this.store.delete('supabaseUser');
            } catch (error) {
                console.warn('[AuthService] store.delete(supabaseUser) failed:', error);
            }
            try {
                clearSchemaClients(); // purge clients de schema cachés (évite réutilisation cross-session)
            } catch (error) {
                console.warn('[AuthService] clearSchemaClients() failed:', error);
            }
            // NOTE: 'schoolId' volontairement conservé — config tenant, pas secret de session.
            // NOTE: tokens Supabase persistés purgés par supabase.auth.signOut() via ElectronStore (supabase-auth.json).
            console.log('[AuthService] Utilisateur Supabase déconnecté. ID nettoyé.');
        }
    }

    async isSupabaseSessionValid(): Promise<boolean> {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();

            if (error) {
                console.error('Erreur vérification session Supabase:', error);
                return false;
            }

            return !!session;
        } catch (error) {
            console.error('Erreur inattendue vérification session:', error);
            return false;
        }
    }

    async getSupabaseAuthUser(): Promise<{ id: string } | null> {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            setCurrentSupabaseUserId(user.id); 
            return { id: user.id };
        }
        setCurrentSupabaseUserId(null);
        return null;
    }

    private formatSupabaseError(error: any): string {
        if (error.message?.includes('ENOTFOUND')) {
            return "Impossible de se connecter au serveur Supabase";
        }
        return error.message || "Erreur inconnue";
    }

    private formatError(error: unknown): string {
        if (error instanceof Error) {
            if (error.message.includes('ENOTFOUND')) {
                return "Problème de connexion au serveur";
            }
            return error.message;
        }
        return "Erreur inconnue";
    }
}
