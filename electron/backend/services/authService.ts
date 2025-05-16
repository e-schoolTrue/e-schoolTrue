import { UserEntity } from '../entities/user';
import { ResultType, ROLE } from '#electron/command';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../../data-source';

export class AuthService {
    private userRepository = AppDataSource.getInstance().getRepository(UserEntity);

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
            const supervisor = await this.userRepository.findOne({ where: { username } });
            if (!supervisor) {
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            const isValid = await bcrypt.compare(password, supervisor.password);
            if (!isValid) {
                return {
                    success: false,
                    data: null,
                    message: "Mot de passe incorrect",
                    error: "INVALID_PASSWORD"
                };
            }

            return {
                success: true,
                data: {
                    id: supervisor.id,
                    username: supervisor.username
                },
                message: "Connexion réussie",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la validation du superviseur:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la validation",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
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
} 