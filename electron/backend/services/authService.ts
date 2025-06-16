import { UserEntity } from '../entities/user';
import { ResultType, ROLE } from '#electron/command';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../../data-source';
import  Store  from 'electron-store';
import { supabaseConfig } from '../../config/supabase';
import { supabase } from '../lib/supabaseClient'; 

export class AuthService {
    private userRepository = AppDataSource.getInstance().getRepository(UserEntity);
    private currentUser: { id: number; username: string } | null = null;
    private store = new Store();
  
      private supabase = supabase; 


    async createSupervisor(username: string, password: string, securityQuestion: string, securityAnswer: string): Promise<ResultType> {
        try {
            // Vérifier si un superviseur existe déjà
            const existingSupervisor = await this.userRepository.findOne({ where: { username } });
            if (existingSupervisor) {
                return {
                    success: false,
                    data: null,
                    message: "Un utilisateur avec ce nom existe déjà",
                    error: "USERNAME_EXISTS"
                };
            }

            // Hasher le mot de passe et la réponse de sécurité
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase(), salt);

            // Créer le superviseur
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

            // Set current user after successful validation
            this.currentUser = {
                id: user.id,
                username: user.username
            };

            console.log("=== Résultat de la validation ===", this.currentUser);

            return {
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    role: user.role
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
        this.currentUser = this.store.get('currentUser') as any; // Récupération
    }

  
    async getCurrentUser(): Promise<{ id: number; username: string } | null> {
        return this.currentUser;
    }


    async logout(): Promise<void> {
        this.currentUser = null;
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

            // Hasher le nouveau mot de passe
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Mettre à jour le mot de passe
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
            // Verify Supabase URL is accessible
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

    async signInWithSupabase(email: string, password: string): Promise<ResultType> {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Erreur connexion Supabase:', error);
                return {
                    success: false,
                    data: null,
                    message: "Échec de la connexion au compte cloud",
                    error: error.message
                };
            }

            // Stocker les informations de connexion Supabase
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
            return {
                success: false,
                data: null,
                message: "Erreur lors de la connexion au compte cloud",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
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
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error || !user) {
                console.warn("Erreur getSupabaseUser:", error?.message || "No user found");
                return null;
            }

            return { id: user.id };
        } catch (error) {
            console.error("Erreur lors de la récupération de l'utilisateur Supabase:", error);
            return null;
        }
    }
}