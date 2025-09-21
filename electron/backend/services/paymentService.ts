import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentAnnualConfigEntity, PaymentConfigEntity, TranchConfigEntity, TrancheEntryEntity } from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { ProfessorEntity } from '../entities/professor';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { ScholarshipEntity } from '../entities/scholarship';
import { IPaymentData, IPaymentConfigData, IProfessorPaymentData, IPaymentServiceResponse, IPaymentServiceParams, IPaymentAnnualConfigData } from '../types/payment';

export interface ResultType<T = any> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

// Interface pour les données de paiement d'un étudiant
export interface StudentPaymentResponse {
    payments: PaymentEntity[];
    baseAmount: number;
    scholarshipPercentage: number;
    scholarshipAmount: number;
    adjustedAmount: number;
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
    private annualConfigRepository: Repository<PaymentAnnualConfigEntity>;
    private tranchConfigRepository: Repository<TranchConfigEntity>;
    private tranchEntryRepository: Repository<TrancheEntryEntity>;
    private initialized: boolean = false;

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
        this.configRepository = AppDataSource.getInstance().getRepository(PaymentConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.professorRepository = AppDataSource.getInstance().getRepository(ProfessorEntity);
        this.professorPaymentRepository = AppDataSource.getInstance().getRepository(ProfessorPaymentEntity);
        this.scholarshipRepository = AppDataSource.getInstance().getRepository(ScholarshipEntity);
        this.annualConfigRepository = AppDataSource.getInstance().getRepository(PaymentAnnualConfigEntity);
        this.tranchConfigRepository = AppDataSource.getInstance().getRepository(TranchConfigEntity);
        this.tranchEntryRepository = AppDataSource.getInstance().getRepository(TrancheEntryEntity);
    }

    private async ensureRepositoriesInitialized(): Promise<void> {
        if (!this.initialized) {
            const dataSource = AppDataSource.getInstance();
            if (!dataSource.isInitialized) {
                await AppDataSource.initialize(false);
            }
            this.paymentRepository = dataSource.getRepository(PaymentEntity);
            this.configRepository = dataSource.getRepository(PaymentConfigEntity);
            this.studentRepository = dataSource.getRepository(StudentEntity);
            this.professorRepository = dataSource.getRepository(ProfessorEntity);
            this.professorPaymentRepository = dataSource.getRepository(ProfessorPaymentEntity);
            this.scholarshipRepository = dataSource.getRepository(ScholarshipEntity);
            this.annualConfigRepository = dataSource.getRepository(PaymentAnnualConfigEntity);
            this.tranchConfigRepository = dataSource.getRepository(TranchConfigEntity);
            this.tranchEntryRepository = dataSource.getRepository(TrancheEntryEntity);
            this.initialized = true;
        }
    }

    async savePaymentAnnualConfig(configData: IPaymentAnnualConfigData){
        AppDataSource.getInstance().transaction(async (entityManager) => {
            try {
                const newConfig = entityManager.create(PaymentAnnualConfigEntity, {
                    id: configData.id,
                    trancheCount: configData.trancheCount,
                    grade_id: configData.grade_id
                });
                const savedConfig = await entityManager.save(newConfig);
                await Promise.all(configData.tranches.map(async tranch => {
                    const newTranchConfig = entityManager.create(TranchConfigEntity, {
                        id: tranch.id,
                        tranchMonthCount: tranch.tranchMonthCount,
                        paymentAnnualConfig: savedConfig,
                    });
                    const savedTranchConfig = await entityManager.save(newTranchConfig);
                    await Promise.all(tranch.entries.map(async entry => {
                        const newTranchEntry = entityManager.create(TrancheEntryEntity, {
                            id: entry.id,
                            startDate: entry.startDate,
                            endDate: entry.endDate,
                            tranchConfig: savedTranchConfig
                        });
                        const savedTranchEntry = await entityManager.save(newTranchEntry);
                    }))
                }))
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration des tranches effectuées avec succès",
                    error: null
                };
            }
            catch (error) {
                console.error("Erreur lors de la sauvegarde:", error);
                return {
                    success: false,
                    data: null,
                    message: "Erreur lors de la sauvegarde de la configuration",
                    error: error instanceof Error ? error.message : "Erreur inconnue"
                };
            }
        });
    }

    async getPaymentAnnualConfigs(){
        AppDataSource.getInstance().transaction(async (entityManager) => {
            try {
                const configs = await entityManager.find(PaymentAnnualConfigEntity, {
                    relations: {
                        tranches: {
                            entries: true
                        }
                    }
                });
                return {
                    success: true,
                    data: configs,
                    message: "Configuration des tranches récupérées avec succès",
                    error: null
                };
            }
            catch (error) {
                console.error("Erreur lors de la récupération:", error);
                return {
                    success: false,
                    data: null,
                    message: "Erreur lors de la récupération de la configuration",
                    error: error instanceof Error ? error.message : "Erreur inconnue"
                };
            }
        });
    }

    async createInitialInscriptionFee(student: StudentEntity): Promise<void> {
        try {
            await this.ensureRepositoriesInitialized();
    
            if (!student.grade) {
                console.log(`Student ${student.id} has no grade, skipping inscription fee.`);
                return;
            }
    
            const config = await this.configRepository.findOne({
                where: { classId: student.grade.id.toString() }
            });
    
            if (!config) {
                console.log(`No payment config found for grade ${student.grade.id}, skipping inscription fee.`);
                return;
            }
    
            const inscriptionFee = student.isNew ? config.inscriptionFee : config.reInscriptionFee;
    
            if (inscriptionFee && inscriptionFee > 0) {
                const payment = this.paymentRepository.create({
                    student: student,
                    amount: inscriptionFee,
                    paymentType: 'inscription',
                    paymentMethod: 'cash', // or a default method
                    created_at: new Date(),
                    baseAmount: inscriptionFee,
                    adjustedAmount: inscriptionFee,
                    scholarshipAmount: 0,
                    scholarshipPercentage: 0,
                });
    
                await this.paymentRepository.save(payment);
                console.log(`Created inscription fee payment of ${inscriptionFee} for student ${student.id}`);
            }
        } catch (error) {
            console.error(`Failed to create initial inscription fee for student ${student.id}:`, error);
            // We don't want to throw an error here, as it might fail the student creation process.
            // Logging the error is sufficient.
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
                    ...configData
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
            const scholarshipPercentage = Number(paymentData.annualScholarshipPercentage || paymentData.scholarshipPercentage || 0);
            const scholarshipApplied = paymentData.scholarshipAppliedOnAnnual || scholarshipPercentage > 0;
            
            console.log('=== DEBUG BOURSE DANS addPayment ===');
            console.log('paymentData.scholarshipAppliedOnAnnual:', paymentData.scholarshipAppliedOnAnnual);
            console.log('paymentData.annualScholarshipPercentage:', paymentData.annualScholarshipPercentage);
            console.log('scholarshipPercentage calculé:', scholarshipPercentage);
            console.log('scholarshipApplied:', scholarshipApplied);
            
            if (scholarshipApplied && scholarshipPercentage > 0) {
                console.log('Création de la bourse avec pourcentage:', scholarshipPercentage);
                
                // Désactiver les bourses existantes
                await this.scholarshipRepository.update(
                    { 
                        studentId: student.id,
                        isActive: true,
                        schoolYear: paymentData.schoolYear || new Date().getFullYear().toString()
                    },
                    { isActive: false }
                );

                // Créer la nouvelle bourse
                const scholarship = this.scholarshipRepository.create({
                    studentId: student.id,
                    percentage: scholarshipPercentage,
                    schoolYear: paymentData.schoolYear || new Date().getFullYear().toString(),
                    isActive: true,
                    created_at: new Date()
                });

                activeScholarship = await this.scholarshipRepository.save(scholarship);
                console.log('Nouvelle bourse créée:', activeScholarship);
            } else {
                console.log('Aucune bourse à créer (scholarshipApplied:', scholarshipApplied, ', scholarshipPercentage:', scholarshipPercentage, ')');
            }

            // Créer le paiement avec la bourse
            const payment = this.paymentRepository.create({
                ...paymentData,
                student: student,
                scholarshipPercentage: scholarshipPercentage,
                scholarshipAmount: Number(paymentData.annualScholarshipAmount || paymentData.scholarshipAmount) || 0,
                adjustedAmount: Number(paymentData.annualAmountAfterScholarship || paymentData.adjustedAmount || paymentData.baseAmount) || 0,
                baseAmount: Number(paymentData.baseAnnualAmount || paymentData.baseAmount) || 0,
                scholarshipId: activeScholarship?.id || null,
                created_at: new Date()
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
                order: { created_at: 'DESC' }
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
    
            const student = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['grade'] });
            if (!student) {
                return { success: false, data: null, message: "Étudiant non trouvé" };
            }

            const config = await this.configRepository.findOne({ where: { classId: student.grade.id.toString() } });
            
            const inscriptionFeeDue = student.isNew ? (config?.inscriptionFee || 0) : (config?.reInscriptionFee || 0);
            const tuitionFeeDue = config?.annualAmount || 0;

            const payments = await this.paymentRepository.find({ where: { student: { id: studentId } } });

            let paidInscriptionFee = 0;
            let paidTuition = 0;

            payments.forEach(p => {
                if (p.paymentType === 'inscription') {
                    paidInscriptionFee += Number(p.amount);
                } else {
                    paidTuition += Number(p.amount);
                }
            });

            const activeScholarship = await this.scholarshipRepository.findOne({ where: { studentId, isActive: true } });
            const scholarshipPercentage = activeScholarship?.percentage || 0;
            const scholarshipAmount = tuitionFeeDue * (scholarshipPercentage / 100);
            const adjustedTuitionFee = tuitionFeeDue - scholarshipAmount;
            const totalDue = inscriptionFeeDue + adjustedTuitionFee;

            const responseData = {
                inscriptionFeeDue,
                tuitionFeeDue,
                paidInscriptionFee,
                paidTuition,
                totalPaid: paidInscriptionFee + paidTuition,
                remainingInscriptionFee: Math.max(0, inscriptionFeeDue - paidInscriptionFee),
                remainingTuition: Math.max(0, adjustedTuitionFee - paidTuition),
                totalRemaining: Math.max(0, totalDue - (paidInscriptionFee + paidTuition)),
                scholarshipPercentage,
                scholarshipAmount,
                adjustedTuitionFee,
                totalDue,
                payments
            };

            return { success: true, data: responseData, message: "Paiements de l'étudiant récupérés avec succès" };
        } catch (error) {
            console.error(`Erreur lors de la récupération des paiements pour l\'étudiant ${studentId}:`, error);
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
                where: { classId: student.grade.id?.toString() || '0' }
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
                where: { student: { id: studentId } }
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
            
            // Calculer le total des paiements
            const totalPaidResult = await this.professorPaymentRepository
                .createQueryBuilder('payment')
                .select('SUM(payment.amount)', 'totalPaid')
                .where('payment.isPaid = :isPaid', { isPaid: true })
                .getRawOne();

            // Calculer le total en attente
            const totalPendingResult = await this.professorPaymentRepository
                .createQueryBuilder('payment')
                .select('SUM(payment.amount)', 'totalPending')
                .where('payment.isPaid = :isPaid', { isPaid: false })
                .getRawOne();

            const stats = {
                totalPaid: Number(totalPaidResult?.totalPaid || 0),
                totalPending: Number(totalPendingResult?.totalPending || 0)
            };

            console.log('Statistiques des paiements calculées:', stats);

            return {
                success: true,
                data: stats,
                message: "Statistiques récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors du calcul des statistiques:', error);
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
                order: { created_at: 'DESC' },
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
