import { User } from '../entities/auth';
import { ResultType } from '#electron/command';
import * as bcrypt from 'bcrypt';

export class AuthService {
    async createSupervisor(username: string, password: string): Promise<ResultType> {
        try {
            // Vérifier si un superviseur existe déjà
            const existingSupervisor = await User.findOne({ where: { username } });
            if (existingSupervisor) {
                return {
                    success: false,
                    data: null,
                    message: "Un utilisateur avec ce nom existe déjà",
                    error: "USERNAME_EXISTS"
                };
            }

            // Hasher le mot de passe
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Créer le superviseur
            const supervisor = User.create({
                username,
                password: hashedPassword
            });

            await supervisor.save();

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
            const supervisor = await User.findOne({ where: { username } });
            if (!supervisor) {
                return {
                    success: false,
                    data: null,
                    message: "Utilisateur non trouvé",
                    error: "USER_NOT_FOUND"
                };
            }

            const isValid = await bcrypt.compare(password, supervisor.password!);
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
} 