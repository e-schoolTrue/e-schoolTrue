import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentConfigEntity} from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';

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

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
        this.configRepository = AppDataSource.getInstance().getRepository(PaymentConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
    }

    async saveConfig(configData: any): Promise<ResultType> {
        try {
            console.log("Données de configuration reçues:", configData);

            // Vérifier si une configuration existe déjà pour cette classe
            const existingConfig = await this.configRepository.findOne({
                where: { classId: configData.classId }
            });

            let savedConfig;
            if (existingConfig) {
                // Mise à jour de la configuration existante
                console.log("Mise à jour de la configuration existante:", existingConfig.id);
                await this.configRepository.update(existingConfig.id, {
                    ...configData,
                    updatedAt: new Date()
                });
                savedConfig = await this.configRepository.findOne({
                    where: { id: existingConfig.id }
                });
            } else {
                // Création d'une nouvelle configuration
                console.log("Création d'une nouvelle configuration");
                const newConfig = this.configRepository.create({
                    ...configData,
                    updatedAt: new Date()
                });
                savedConfig = await this.configRepository.save(newConfig);
            }

            console.log("Configuration sauvegardée avec succès:", savedConfig);

            return {
                success: true,
                data: savedConfig,
                message: "Configuration sauvegardée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de la configuration:", error);
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de la sauvegarde",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigs(): Promise<ResultType> {
        try {
            const configs = await this.configRepository.find();
            return {
                success: true,
                data: configs,
                message: "Configurations récupérées avec succès",
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

    async addPayment(paymentData: Partial<PaymentEntity>): Promise<ResultType> {
        console.log('=== Début du traitement dans PaymentService ===');
        console.log('Données de paiement reçues:', JSON.stringify(paymentData, null, 2));
        
        try {
            if (!paymentData.studentId) {
                console.error('Erreur: StudentId manquant dans les données');
                throw new Error('StudentId est requis');
            }
            
            console.log('=== Recherche de l\'étudiant ===');
            console.log('StudentId recherché:', paymentData.studentId);
    
            // Vérifier que l'étudiant existe
            const student = await this.studentRepository.findOne({
                where: { id: paymentData.studentId }
            });
    
            console.log('Résultat de la recherche étudiant:', student ? 'Trouvé' : 'Non trouvé');
            if (student) {
                console.log('Détails de l\'étudiant:', JSON.stringify(student, null, 2));
            }
    
            if (!student) {
                console.error('Étudiant non trouvé');
                return {
                    success: false,
                    data: null,
                    message: "Étudiant non trouvé",
                    error: "STUDENT_NOT_FOUND"
                };
            }
    
            console.log('=== Création de l\'entité payment ===');
            // Création et sauvegarde du paiement
            const payment = this.paymentRepository.create({
                ...paymentData,
                student
            });
            
            console.log('Entity payment créée avec les données:');
            console.log(JSON.stringify(payment, null, 2));
    
            console.log('=== Tentative de sauvegarde du paiement ===');
            const savedPayment = await this.paymentRepository.save(payment);
            console.log('Payment sauvegardé avec succès:');
            console.log(JSON.stringify(savedPayment, null, 2));
    
            console.log('=== Vérification de la sauvegarde ===');
            // Vérification de la sauvegarde
            const verifiedPayment = await this.paymentRepository.findOne({
                where: { id: savedPayment.id },
                relations: ['student']
            });
    
            console.log('Résultat de la vérification:', verifiedPayment ? 'Payment vérifié' : 'Payment non trouvé');
            if (verifiedPayment) {
                console.log('Détails du payment vérifié:', JSON.stringify(verifiedPayment, null, 2));
            }
    
            if (!verifiedPayment) {
                console.error('Erreur: Le paiement a été créé mais non retrouvé en base');
                throw new Error('Le paiement a été créé mais non retrouvé en base');
            }
    
            console.log('=== Traitement terminé avec succès ===');
            return {
                success: true,
                data: verifiedPayment,
                message: "Paiement enregistré avec succès",
                error: null
            };
    
        } catch (error) {
            console.error('=== Erreur dans PaymentService ===');
            console.error('Type d\'erreur:', );
            console.error('Message d\'erreur:', );
            console.error('Stack trace:', );
            
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement",
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
                order: { paymentDate: 'DESC' }
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
                order: { paymentDate: 'DESC' },
                relations: ['student']
            });

            return {
                success: true,
                data: payments,
                message: "Paiements de l'étudiant récupérés avec succès",
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

    async getConfigByClass(classId: number): Promise<ResultType> {
        try {
            const config = await this.configRepository.findOne({
                where: { classId }
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
                where: { classId: student.classId as number }
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
                    remaining,
                    installments: config.installments
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
}
