import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentConfigEntity } from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { ProfessorEntity } from '../entities/professor';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { ScholarshipEntity } from '../entities/scholarship';
import { IPaymentData, IPaymentConfigData, IProfessorPaymentData, IPaymentServiceResponse } from '../types/payment';

export interface ResultType<T = any> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

// Créer un type pour les données de paiement
type PaymentCreateData = Omit<PaymentEntity, 'id'> & {
    scholarshipPercentage?: number;
    scholarshipAmount?: number;
    adjustedAmount?: number;
    baseAmount?: number;
};

export class PaymentService {
    private paymentRepository: Repository<PaymentEntity>;
    private configRepository: Repository<PaymentConfigEntity>;
    private studentRepository: Repository<StudentEntity>;
    private professorRepository: Repository<ProfessorEntity>;
    private professorPaymentRepository: Repository<ProfessorPaymentEntity>;
    private scholarshipRepository: Repository<ScholarshipEntity>;
    private initialized: boolean = false;

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
        this.configRepository = AppDataSource.getInstance().getRepository(PaymentConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.professorRepository = AppDataSource.getInstance().getRepository(ProfessorEntity);
        this.professorPaymentRepository = AppDataSource.getInstance().getRepository(ProfessorPaymentEntity);
        this.scholarshipRepository = AppDataSource.getInstance().getRepository(ScholarshipEntity);
    }

    private async ensureRepositoriesInitialized(): Promise<void> {
        if (!this.initialized) {
            const dataSource = AppDataSource.getInstance();
            if (!dataSource.isInitialized) {
                await AppDataSource.initialize();
            }
            this.paymentRepository = dataSource.getRepository(PaymentEntity);
            this.configRepository = dataSource.getRepository(PaymentConfigEntity);
            this.studentRepository = dataSource.getRepository(StudentEntity);
            this.professorRepository = dataSource.getRepository(ProfessorEntity);
            this.professorPaymentRepository = dataSource.getRepository(ProfessorPaymentEntity);
            this.scholarshipRepository = dataSource.getRepository(ScholarshipEntity);
            this.initialized = true;
        }
    }

    async saveConfig(configData: IPaymentConfigData): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const existingConfig = await this.configRepository.findOne({
                where: { classId: configData.classId }
            });

            if (existingConfig) {
                Object.assign(existingConfig, {
                    annualAmount: configData.annualAmount,
                    allowScholarship: configData.allowScholarship,
                    scholarshipPercentages: configData.scholarshipPercentages,
                    scholarshipCriteria: configData.scholarshipCriteria
                });
                
                const savedConfig = await this.configRepository.save(existingConfig);
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration mise à jour avec succès",
                    error: null
                };
            } else {
                const newConfig = this.configRepository.create({
                    ...configData,
                    allowScholarship: configData.allowScholarship || false,
                    scholarshipPercentages: configData.scholarshipPercentages || [],
                    scholarshipCriteria: configData.scholarshipCriteria || ''
                });
                const savedConfig = await this.configRepository.save(newConfig);
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration créée avec succès",
                    error: null
                };
            }
        } catch (error) {
            console.error("Erreur lors de la sauvegarde:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigs(): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const configs = await this.configRepository.find();
            console.log("Configurations récupérées:", configs);
            
            return {
                success: true,
                data: configs.map(config => ({
                    ...config,
                    allowScholarship: Boolean(config.allowScholarship),
                    scholarshipPercentages: Array.isArray(config.scholarshipPercentages) 
                        ? config.scholarshipPercentages 
                        : []
                })),
                message: "Configurations récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la récupération:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des configurations",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async addPayment(paymentData: IPaymentData): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            console.log('=== Tentative d\'ajout de paiement ===');
            console.log('Données reçues:', paymentData);

            // Vérifier l'étudiant
            const student = await this.studentRepository.findOne({
                where: { id: paymentData.studentId },
                relations: ['scholarship']
            });

            if (!student) {
                throw new Error('Étudiant non trouvé');
            }

            // Si une bourse est spécifiée, créer ou mettre à jour la bourse
            let activeScholarship = null;
            if ((paymentData.scholarshipPercentage ?? 0) > 0) {
                // Désactiver les bourses existantes
                await this.scholarshipRepository.update(
                    { 
                        studentId: student.id,
                        isActive: true,
                        schoolYear: new Date().getFullYear().toString()
                    },
                    { isActive: false }
                );

                // Créer la nouvelle bourse
                const scholarship = this.scholarshipRepository.create({
                    studentId: student.id,
                    percentage: paymentData.scholarshipPercentage,
                    schoolYear: paymentData.schoolYear || new Date().getFullYear().toString(),
                    isActive: true,
                    createdAt: new Date()
                });

                activeScholarship = await this.scholarshipRepository.save(scholarship);
                console.log('Nouvelle bourse créée:', activeScholarship);
            }

            // Créer le paiement avec la bourse
            const payment = this.paymentRepository.create({
                ...paymentData,
                scholarshipPercentage: Number(paymentData.scholarshipPercentage) || 0,
                scholarshipAmount: Number(paymentData.scholarshipAmount) || 0,
                adjustedAmount: Number(paymentData.adjustedAmount) || Number(paymentData.baseAmount) || 0,
                baseAmount: Number(paymentData.baseAmount) || 0,
                scholarshipId: activeScholarship?.id || null,
                createdAt: new Date()
            } as PaymentCreateData);

            console.log('Paiement à sauvegarder:', payment);

            const savedPayment = await this.paymentRepository.save(payment);
            console.log('Paiement sauvegardé:', savedPayment);

            return {
                success: true,
                data: savedPayment,
                message: "Paiement enregistré avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de l'ajout du paiement:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getPayments(page: number = 1, limit: number = 10): Promise<IPaymentServiceResponse> {
        try {
            const [payments, total] = await this.paymentRepository.findAndCount({
                relations: ['student', 'scholarship'],
                skip: (page - 1) * limit,
                take: limit,
                order: { createdAt: 'DESC' }
            });

            return {
                success: true,
                data: { payments, total },
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async addProfessorPayment(paymentData: IProfessorPaymentData): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professor = await this.professorRepository.findOne({
                where: { id: paymentData.professorId },
                relations: ['teaching']
            });

            if (!professor) {
                return {
                    success: false,
                    data: null,
                    message: "Professeur non trouvé",
                    error: "PROFESSOR_NOT_FOUND"
                };
            }

            const payment = this.professorPaymentRepository.create({
                professor,
                professorId: professor.id,
                amount: paymentData.amount,
                type: paymentData.type,
                paymentMethod: paymentData.paymentMethod,
                month: paymentData.month,
                reference: paymentData.reference || '',
                comment: paymentData.comment || '',
                isPaid: true,
                grossAmount: paymentData.grossAmount,
                netAmount: paymentData.netAmount,
                deductions: paymentData.deductions || [],
                additions: paymentData.additions || []
            });

            const savedPayment = await this.professorPaymentRepository.save(payment);

            return {
                success: true,
                data: savedPayment,
                message: "Paiement enregistré avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur détaillée:', error);
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getPaymentsByStudent(studentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payments = await this.paymentRepository.find({
                where: { studentId },
                relations: ['student', 'scholarship'],
                order: { createdAt: 'DESC' }
            });

            return {
                success: true,
                data: payments,
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigByClass(classId: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const config = await this.configRepository.findOne({
                where: { classId }
            });

            return {
                success: true,
                data: config,
                message: "Configuration récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getRemainingAmount(studentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['grade']
            });

            if (!student || !student.grade) {
                return {
                    success: false,
                    data: null,
                    message: "Étudiant ou classe non trouvé",
                    error: "STUDENT_OR_GRADE_NOT_FOUND"
                };
            }

            const config = await this.configRepository.findOne({
                where: { classId: student.grade.id.toString() }
            });

            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Configuration de paiement non trouvée",
                    error: "PAYMENT_CONFIG_NOT_FOUND"
                };
            }

            const payments = await this.paymentRepository.find({
                where: { studentId }
            });

            const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remaining = Number(config.annualAmount) - totalPaid;

            return {
                success: true,
                data: { remaining },
                message: "Montant restant calculé avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul du montant restant",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async updateProfessorPayment(paymentData: IPaymentServiceParams['updateProfessorPayment']): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payment = await this.professorPaymentRepository.findOne({
                where: { id: paymentData.id }
            });

            if (!payment) {
                return {
                    success: false,
                    data: null,
                    message: "Paiement non trouvé",
                    error: "PAYMENT_NOT_FOUND"
                };
            }

            Object.assign(payment, paymentData);
            const updatedPayment = await this.professorPaymentRepository.save(payment);

            return {
                success: true,
                data: updatedPayment,
                message: "Paiement mis à jour avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPayments(filters: any): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payments = await this.professorPaymentRepository.find({
                where: filters,
                relations: ['professor'],
                order: { month: 'DESC' }
            });

            return {
                success: true,
                data: payments,
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPaymentStats(): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const stats = await this.professorPaymentRepository
                .createQueryBuilder('payment')
                .select('COUNT(*)', 'total')
                .addSelect('SUM(amount)', 'totalAmount')
                .getRawOne();

            return {
                success: true,
                data: stats,
                message: "Statistiques récupérées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPaymentById(paymentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payment = await this.professorPaymentRepository.findOne({
                where: { id: paymentId },
                relations: ['professor']
            });

            if (!payment) {
                return {
                    success: false,
                    data: null,
                    message: "Paiement non trouvé",
                    error: "PAYMENT_NOT_FOUND"
                };
            }

            return {
                success: true,
                data: payment,
                message: "Paiement récupéré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getActiveByStudent(studentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const scholarship = await this.scholarshipRepository.findOne({
                where: { 
                    studentId,
                    isActive: true,
                    schoolYear: new Date().getFullYear().toString()
                }
            });

            return {
                success: true,
                data: scholarship,
                message: "Bourse active récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la bourse active",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getRecentPayments(limit: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payments = await this.paymentRepository.find({
                relations: ['student'],
                order: { createdAt: 'DESC' },
                take: limit
            });

            return {
                success: true,
                data: payments,
                message: "Paiements récents récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements récents",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}
