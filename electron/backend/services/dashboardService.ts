import { AppDataSource } from "#electron/data-source";
import { ResultType } from "#electron/command";
import { StudentEntity } from "../entities/students";
import { ProfessorEntity } from "../entities/professor";
import { GradeEntity } from "../entities/grade";
import { PaymentEntity } from "../entities/payment";
import { AbsenceEntity } from "../entities/absence";
import { IDashboardServiceResponse, IRecentPayment } from "../types/dashboard";
import { StudentService } from "./studentService";

export class DashboardService {
    async getTotalStudents(): Promise<ResultType> {
        try {
            const studentService = new StudentService();
            const result = await studentService.getTotalStudents();
            return {
                success: result.success,
                data: result.data,
                message: result.message,
                error: result.error
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du nombre total d'étudiants",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getTotalProfessors(): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const professorRepo = dataSource.getRepository(ProfessorEntity);
            const count = await professorRepo.count();

            return {
                success: true,
                data: count,
                message: "Nombre total de professeurs récupéré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du nombre de professeurs",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getTotalClasses(): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const gradeRepo = dataSource.getRepository(GradeEntity);
            const count = await gradeRepo.count();

            return {
                success: true,
                data: count,
                message: "Nombre total de classes récupéré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du nombre de classes",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getRecentPayments(limit: number = 5): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const paymentRepo = dataSource.getRepository(PaymentEntity);
            const payments = await paymentRepo.find({
                relations: ['student'],
                order: { createdAt: 'DESC' },
                take: limit
            });

            const formattedPayments: IRecentPayment[] = payments.map(payment => ({
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

    async getPaymentStats(): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const paymentRepo = dataSource.getRepository(PaymentEntity);
            
            const lastSixMonths = new Date();
            lastSixMonths.setMonth(lastSixMonths.getMonth() - 6);

            const payments = await paymentRepo
                .createQueryBuilder('payment')
                .where('payment.createdAt >= :startDate', { startDate: lastSixMonths })
                .andWhere('payment.createdAt <= :endDate', { endDate: new Date() })
                .orderBy('payment.createdAt', 'ASC')
                .getMany();

            const monthlyPayments = payments.reduce((acc: { [key: string]: number }, payment:any) => {
                const month = new Date(payment.createdAt).toLocaleString('fr-FR', { month: 'long' });
                acc[month] = (acc[month] || 0) + payment.amount;
                return acc;
            }, {});

            return {
                success: true,
                data: monthlyPayments,
                message: "Statistiques de paiement récupérées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques de paiement",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getAbsenceStats(): Promise<ResultType> {
        try {
            console.log('=== Service Dashboard - Début getAbsenceStats ===');
            
            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            
            const lastThreeMonths = new Date();
            lastThreeMonths.setMonth(lastThreeMonths.getMonth() - 3);

            const absences = await absenceRepo
                .createQueryBuilder('absence')
                .leftJoinAndSelect('absence.grade', 'grade')
                .leftJoinAndSelect('absence.student', 'student')
                .leftJoinAndSelect('absence.professor', 'professor')
                .where('absence.createdAt >= :startDate', { startDate: lastThreeMonths })
                .andWhere('absence.createdAt <= :endDate', { endDate: new Date() })
                .getMany();

            console.log('Types des absences trouvées:', absences.map((a:any) => a.type));

            const absencesByGrade = absences.reduce((acc: { [key: string]: number }, absence:any) => {
                if (absence.type === 'STUDENT' && absence.grade?.name) {
                    const gradeName = absence.grade.name;
                    acc[gradeName] = (acc[gradeName] || 0) + 1;
                } else if (absence.type === 'PROFESSOR') {
                    acc['Professeurs'] = (acc['Professeurs'] || 0) + 1;
                }
                return acc;
            }, {});

            console.log('Statistiques calculées:', absencesByGrade);

            return {
                success: true,
                data: absencesByGrade,
                message: "Statistiques d'absence récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur détaillée dans getAbsenceStats:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques d'absence",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getStats(): Promise<IDashboardServiceResponse> {
        try {
            const [totalStudents, totalProfessors, totalClasses, recentPayments, recentAbsences] = 
                await Promise.all([
                    this.getTotalStudents(),
                    this.getTotalProfessors(),
                    this.getTotalClasses(),
                    this.getRecentPayments(5),
                    this.getAbsenceStats()
                ]);

            return {
                success: true,
                data: {
                    stats: {
                        totalStudents: totalStudents.data || 0,
                        totalProfessors: totalProfessors.data || 0,
                        totalClasses: totalClasses.data || 0,
                        recentPayments: recentPayments.data || [],
                        recentAbsences: recentAbsences.data || {}
                    }
                },
                message: "Statistiques récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur lors de la récupération des statistiques:', error);
            return {
                success: false,
                data: {
                    stats: {
                        totalStudents: 0,
                        totalProfessors: 0,
                        totalClasses: 0,
                        recentPayments: [],
                        recentAbsences: {}
                    }
                },
                message: "Erreur lors de la récupération des statistiques",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
} 