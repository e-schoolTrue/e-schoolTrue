import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentConfigEntity} from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { ProfessorEntity } from '../entities/professor';
import { ProfessorPaymentEntity } from '../entities/professorPayment';

export interface ResultType {
    success: boolean;
    data: any;
    message: string;
    error: string | null;
}


export class PaymentService {
    [x: string]: any;
    private paymentRepository: Repository<PaymentEntity>;
    private configRepository: Repository<PaymentConfigEntity>;
    private studentRepository: Repository<StudentEntity>;
    private professorRepository: Repository<ProfessorEntity>;
    private professorPaymentRepository: Repository<ProfessorPaymentEntity>;
    private initialized: boolean = false;

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
        this.configRepository = AppDataSource.getInstance().getRepository(PaymentConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.professorRepository = AppDataSource.getInstance().getRepository(ProfessorEntity);
        this.professorPaymentRepository = AppDataSource.getInstance().getRepository(ProfessorPaymentEntity);
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
                existingConfig.annualAmount = configData.annualAmount;
                const savedConfig = await this.configRepository.save(existingConfig);
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration mise à jour avec succès",
                    error: null
                };
            } else {
                const newConfig = this.configRepository.create({
                    classId: configData.classId,
                    annualAmount: configData.annualAmount
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
            console.log("Récupération des configurations");
            
            const configs = await this.configRepository.find();
            console.log("Configurations trouvées:", configs);

            return {
                success: true,
                data: configs,
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
        console.log('=== Début du traitement dans PaymentService ===');
        console.log('Données de paiement reçues:', JSON.stringify(paymentData, null, 2));
        
        try {
            if (!paymentData.studentId) {
                throw new Error('StudentId est requis');
            }

            if (!paymentData.paymentType) {
                throw new Error('Le type de paiement est requis');
            }

            if (!paymentData.amount) {
                throw new Error('Le montant est requis');
            }
            
            const student = await this.studentRepository.findOne({
                where: { id: paymentData.studentId }
            });

            if (!student) {
                return {
                    success: false,
                    data: null,
                    message: "Étudiant non trouvé",
                    error: "STUDENT_NOT_FOUND"
                };
            }

            // Création du paiement avec les champs requis
            const payment = this.paymentRepository.create({
                amount: paymentData.amount,
                paymentType: paymentData.paymentType,
                student,
                createdAt: new Date(),
                installmentNumber: paymentData.installmentNumber || 1,
                schoolYear: paymentData.schoolYear || new Date().getFullYear().toString(),
                comment: paymentData.comment || ''
            });
            
            const savedPayment = await this.paymentRepository.save(payment);

            const verifiedPayment = await this.paymentRepository.findOne({
                where: { id: savedPayment.id },
                relations: ['student']
            });

            if (!verifiedPayment) {
                throw new Error('Le paiement a été créé mais non retrouvé en base');
            }

            return {
                success: true,
                data: verifiedPayment,
                message: "Paiement enregistré avec succès",
                error: null
            };

        } catch (error) {
            console.error('=== Erreur dans PaymentService ===');
            console.error('Message d\'erreur:', error);
            
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getPayments(page: number = 1, limit: number = 10): Promise<ResultType> {
        try {
            const [payments, total] = await this.paymentRepository.findAndCount({
                relations: ['student'],
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
                relations: ['student'],
                order: { createdAt: 'DESC' }
            });

            return {
                success: true,
                data: payments,
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
                relations: ['student'],
                order: { createdAt: 'DESC' },
                take: limit
            });

            const formattedPayments = payments.map(payment => ({
                id: payment.id,
                studentName: `${payment.student.firstname} ${payment.student.lastname}`,
                amount: payment.amount,
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
}
