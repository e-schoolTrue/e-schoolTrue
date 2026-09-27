import { Repository, Like } from "typeorm";
import * as bcrypt from 'bcryptjs';
import { ROLE } from '#electron/command';
import { UserEntity } from '../entities/user';
import { AppDataSource } from '../../data-source';
import { Role } from '../security';

export interface UserAdminDTO {
    id: number;
    username: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
}

function userNotFound(): never {
    const error: any = new Error("Utilisateur non trouvé");
    error.code = 'USER_NOT_FOUND';
    throw error;
}

export class UserAdminService {
    private userRepository: Repository<UserEntity>;

    constructor() {
        this.userRepository = AppDataSource.getInstance().getRepository(UserEntity);
    }

    private toDto(user: UserEntity): UserAdminDTO {
        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? null,
            role: user.role,
            isActive: user.isActive !== false,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt ?? null
        };
    }

    async list(params: { page: number; pageSize: number; search?: string }): Promise<{ items: UserAdminDTO[]; total: number }> {
        const search = params.search?.trim();
        const [users, total] = await this.userRepository.findAndCount({
            where: search
                ? [{ username: Like(`%${search}%`) }, { displayName: Like(`%${search}%`) }]
                : {},
            order: { createdAt: 'DESC', id: 'DESC' },
            skip: (params.page - 1) * params.pageSize,
            take: params.pageSize
        });
        return { items: users.map((user) => this.toDto(user)), total };
    }

    async getById(id: number): Promise<UserAdminDTO | null> {
        const user = await this.userRepository.findOne({ where: { id } });
        return user ? this.toDto(user) : null;
    }

    async create(input: { username: string; password: string; displayName?: string; role: Role; securityQuestion?: string; securityAnswer?: string }): Promise<UserAdminDTO> {
        const existing = await this.userRepository.findOne({ where: { username: input.username } });
        if (existing) {
            const error: any = new Error("Un utilisateur avec ce nom existe déjà");
            error.code = 'USERNAME_EXISTS';
            throw error;
        }

        const saltRounds = 10;
        let securityQuestion = input.securityQuestion;
        let securityAnswer = input.securityAnswer;
        if ((input.role === 'professor' || input.role === 'student') && (!securityQuestion || !securityAnswer)) {
            securityQuestion = 'Question par défaut';
            securityAnswer = Math.random().toString(36).slice(2);
        }

        const user = this.userRepository.create({
            username: input.username,
            password: bcrypt.hashSync(input.password, saltRounds),
            displayName: input.displayName ?? null,
            role: input.role as ROLE,
            isActive: true,
            securityQuestion: securityQuestion ?? '',
            securityAnswer: bcrypt.hashSync((securityAnswer ?? '').toLowerCase(), saltRounds)
        });
        const saved = await this.userRepository.save(user);
        return this.toDto(saved);
    }

    async update(input: { id: number; displayName?: string; role?: Role }): Promise<UserAdminDTO> {
        const user = await this.userRepository.findOne({ where: { id: input.id } });
        if (!user) return userNotFound();
        if (input.displayName !== undefined) user.displayName = input.displayName;
        if (input.role !== undefined) user.role = input.role as ROLE;
        const saved = await this.userRepository.save(user);
        return this.toDto(saved);
    }

    async setActive(input: { id: number; isActive: boolean }): Promise<UserAdminDTO> {
        const user = await this.userRepository.findOne({ where: { id: input.id } });
        if (!user) return userNotFound();
        if (input.isActive === false && user.role === ROLE.admin) {
            const activeAdmins = await this.userRepository.count({ where: { role: ROLE.admin, isActive: true } });
            if (activeAdmins <= 1) {
                const error: any = new Error("LAST_ADMIN: Impossible de désactiver le dernier administrateur actif");
                error.code = 'LAST_ADMIN';
                throw error;
            }
        }
        user.isActive = input.isActive;
        const saved = await this.userRepository.save(user);
        return this.toDto(saved);
    }

    async resetPassword(input: { id: number; newPassword: string }): Promise<UserAdminDTO> {
        const user = await this.userRepository.findOne({ where: { id: input.id } });
        if (!user) return userNotFound();
        user.password = bcrypt.hashSync(input.newPassword, 10);
        const saved = await this.userRepository.save(user);
        return this.toDto(saved);
    }
}