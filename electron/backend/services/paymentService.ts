import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentConfigEntity} from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { ProfessorEntity } from '../entities/professor';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { ScholarshipEntity } from '../entities/scholarship';

export interface ResultType {
    success: boolean;
    data: any;
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
    [x: string]: any;
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

    async saveConfig(configData: any): Promise<ResultType> {
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

    async getConfigs(): Promise<ResultType> {
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

    async addPayment(paymentData: Partial<PaymentEntity>): Promise<ResultType> {
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

    async getPayments(page: number = 1, limit: number = 10): Promise<ResultType> {
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

    async getPaymentsByStudent(studentId: number): Promise<ResultType> {
        try {
            const payments = await this.paymentRepository.find({
                where: { studentId },
                relations: ['student', 'scholarship'],
                order: { createdAt: 'DESC' }
            });

            // Récupérer la configuration de paiement
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['grade']
            });

            if (!student?.grade) {
                throw new Error("Grade de l'étudiant non trouvé");
            }

            const config = await this.configRepository.findOne({
                where: { classId: student.grade?.id?.toString() }
            });

            // Récupérer la bourse active
            const activeScholarship = await this.scholarshipRepository.findOne({
                where: {
                    studentId,
                    isActive: true,
                    schoolYear: new Date().getFullYear().toString()
                }
            });

            // Calculer les montants avec la bourse
            const baseAmount = config?.annualAmount || 0;
            const scholarshipPercentage = activeScholarship?.percentage || 0;
            const scholarshipAmount = (baseAmount * scholarshipPercentage) / 100;
            const adjustedAmount = baseAmount - scholarshipAmount;

            return {
                success: true,
                data: {
                    payments,
                    baseAmount,
                    scholarshipPercentage,
                    scholarshipAmount,
                    adjustedAmount
                },
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans getPaymentsByStudent:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getConfigByClass(classId: number): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const config = await this.configRepository.findOne({
                where: { classId: String(classId) }
            });

            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Configuration non trouvée pour cette classe",
                    error: "Configuration non trouvée"
                };
            }

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

    async getRemainingAmount(studentId: number): Promise<ResultType> {
        try {
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['payments']
            });
    
            if (!student) {
                throw new Error("Étudiant non trouvé");
            }
    
            if (!student.classId) {
                throw new Error("L'étudiant n'est associé à aucune classe");
            }
    
            // Maintenant TypeScript sait que classId est un number
            const config = await this.configRepository.findOne({
                where: { classId: String(student.classId) }
            });
    
            if (!config) {
                throw new Error("Configuration de paiement non trouvée");
            }
    
            // Ajout d'une vérification pour s'assurer que payments existe
            const payments = student.payments || [];
            const totalPaid = payments.reduce((sum: any, payment: { amount: any; }) => {
                return sum + (payment.amount || 0);
            }, 0);
    
            const remaining = config.annualAmount - totalPaid;
    
            return {
                success: true,
                data: {
                    totalAmount: config.annualAmount,
                    totalPaid,
                    remaining
                },
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

    async getRecentPayments(limit: number = 5): Promise<ResultType> {
        try {
            const payments = await this.paymentRepository.find({
                relations: ['student', 'scholarship'],
                order: { createdAt: 'DESC' },
                take: limit
            });

            const formattedPayments = payments.map(payment => ({
                id: payment.id,
                studentName: `${payment.student.firstname} ${payment.student.lastname}`,
                amount: payment.amount,
                scholarshipPercentage: payment.scholarshipPercentage,
                scholarshipAmount: payment.scholarshipAmount,
                date: payment.createdAt
            }));

            return {
                success: true,
                data: formattedPayments,
                message: "Paiements récents récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements récents",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async addProfessorPayment(paymentData: any): Promise<ResultType> {
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

    async getProfessorPayments(filters: any): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const queryBuilder = this.professorPaymentRepository
                .createQueryBuilder('payment')
                .leftJoinAndSelect('payment.professor', 'professor');

            // Appliquer les filtres
            if (filters?.month) {
                queryBuilder.andWhere('payment.month = :month', { month: filters.month });
            }

            if (filters?.status) {
                queryBuilder.andWhere('payment.isPaid = :isPaid', { 
                    isPaid: filters.status === 'paid' 
                });
            }

            const payments = await queryBuilder
                .orderBy('payment.createdAt', 'DESC')
                .getMany();

            return {
                success: true,
                data: payments,
                message: "Liste des paiements récupérée avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la récupération des paiements:', error);
            return {
                success: false,
                data: [],
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPaymentStats(): Promise<ResultType> {
        try {
            const totalPaid = await this.professorPaymentRepository
                .createQueryBuilder("payment")
                .where("payment.isPaid = :isPaid", { isPaid: true })
                .select("SUM(payment.amount)", "total")
                .getRawOne();

            const totalPending = await this.professorPaymentRepository
                .createQueryBuilder("payment")
                .where("payment.isPaid = :isPaid", { isPaid: false })
                .select("SUM(payment.amount)", "total")
                .getRawOne();

            return {
                success: true,
                data: {
                    totalPaid: totalPaid?.total || 0,
                    totalPending: totalPending?.total || 0
                },
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

    async getTotalProfessors(): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const count = await this.professorRepository
                .createQueryBuilder('professor')
                .getCount();

            console.log('Nombre total de professeurs:', count);

            return {
                success: true,
                data: count,
                message: "Nombre total de professeurs récupéré avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors du comptage des professeurs:', error);
            return {
                success: false,
                data: 0,
                message: "Erreur lors du comptage des professeurs",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPaymentById(paymentId: number): Promise<ResultType> {
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
                    error: "Payment not found"
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
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async updateProfessorPayment(paymentData: any): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();

            const payment = await this.professorPaymentRepository.findOne({
                where: { id: paymentData.id },
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

            // Mettre à jour les champs modifiables
            Object.assign(payment, {
                isPaid: paymentData.isPaid,
                amount: paymentData.amount,
                type: paymentData.type,
                paymentMethod: paymentData.paymentMethod,
                month: paymentData.month,
                reference: paymentData.reference,
                comment: paymentData.comment,
                // Ajout des champs manquants
                grossAmount: paymentData.grossAmount,
                netAmount: paymentData.netAmount,
                deductions: paymentData.deductions || [],
                additions: paymentData.additions || []
            });

            const savedPayment = await this.professorPaymentRepository.save(payment);

            return {
                success: true,
                data: savedPayment,
                message: "Paiement mis à jour avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur détaillée:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    calculateAmountWithScholarship(amount: number, scholarshipPercentage: number): number {
        if (scholarshipPercentage <= 0 || scholarshipPercentage > 100) {
            return amount;
        }
        return amount * (1 - scholarshipPercentage / 100);
    }

    async assignScholarship(data: {
        studentId: number;
        configId: number;
        percentage: number;
        reason?: string;
    }): Promise<ResultType> {
        try {
            const scholarship = this.scholarshipRepository.create({
                studentId: data.studentId,
                percentage: data.percentage,
                reason: data.reason,
                schoolYear: new Date().getFullYear().toString(),
                isActive: true
            });

            await this.scholarshipRepository.save(scholarship);

            return {
                success: true,
                data: scholarship,
                message: "Bourse attribuée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'attribution de la bourse",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getActiveScholarship(studentId: number): Promise<ResultType> {
        try {
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
                message: "Bourse récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la bourse",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getByStudent(studentId: number): Promise<ResultType> {
        try {
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['grade', 'scholarship']
            });

            if (!student) {
                throw new Error('Étudiant non trouvé');
            }

            const payments = await this.paymentRepository.find({
                where: { studentId },
                relations: ['scholarship'],
                order: { createdAt: 'DESC' }
            });

            const config = await this.configRepository.findOne({
                where: { classId: student.grade?.id?.toString() }
            });

            if (!config) {
                throw new Error('Configuration de paiement non trouvée');
            }

            const activeScholarship = student.scholarship?.find(s => 
                s.isActive && s.schoolYear === new Date().getFullYear().toString()
            );

            const baseAmount = config.annualAmount;
            const scholarshipPercentage = activeScholarship?.percentage || 0;
            const scholarshipAmount = baseAmount * (scholarshipPercentage / 100);
            const adjustedAmount = baseAmount - scholarshipAmount;

            return {
                success: true,
                data: {
                    payments,
                    baseAmount,
                    scholarshipPercentage,
                    scholarshipAmount,
                    adjustedAmount,
                    config
                },
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la récupération des paiements:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getActiveByStudent(studentId: number): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const scholarship = await this.scholarshipRepository.findOne({
                where: {
                    studentId,
                    isActive: true,
                    schoolYear: new Date().getFullYear().toString()
                }
            });

            console.log(`=== Bourse active pour l'étudiant ${studentId} ===`);
            console.log('Bourse trouvée:', scholarship);

            return {
                success: true,
                data: scholarship,
                message: scholarship ? "Bourse active trouvée" : "Aucune bourse active",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la récupération de la bourse active:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la bourse active",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}
