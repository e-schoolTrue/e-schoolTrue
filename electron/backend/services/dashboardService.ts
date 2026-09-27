import { AppDataSource } from "#electron/data-source";
import { logger } from "../utils/logger";
import { ResultType } from "#electron/command";
import { ProfessorEntity } from "../entities/professor";
import { GradeEntity } from "../entities/grade";
import { PaymentEntity } from "../entities/payment";
import { AbsenceEntity } from "../entities/absence";
import { ProfessorPaymentEntity } from "../entities/professorPayment";
import { IDashboardServiceResponse, IRecentPayment, IRecentAbsence, IProfessorRecentPayment, IAbsenceStats } from "../types/dashboard";
import { StudentService } from "./studentService";

export class DashboardService {
    /**
     * Verrou année scolaire : effectif scopé sur l'année du login quand elle est
     * passée explicitement (le frontend envoie toujours l'année du login).
     * Sans paramètre : délégation historique à `StudentService` (aucun changement).
     * Lignes legacy sans schoolYear conservées (rétro-compat).
     */
    async getTotalStudents(schoolYear?: string): Promise<ResultType> {
        try {
            const studentService = new StudentService();
            const result = await studentService.getTotalStudents();
            if (schoolYear == null || schoolYear === '') {
                return {
                    success: result.success,
                    data: result.data,
                    message: result.message ?? "",
                    error: result.error
                };
            }
            // Scopage explicite : recompte filtré sur l'année du login.
            try {
                const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
                const { matchesSchoolYearValue } = await import("../lib/schoolYear");
                const { StudentEntity } = await import("../entities/students");
                const sy = await resolveTargetSchoolYear(schoolYear);
                const repo = AppDataSource.getInstance().getRepository(StudentEntity);
                const all: Array<{ schoolYear?: unknown }> = await repo.find({} as never);
                const scoped = all.filter((s) => matchesSchoolYearValue(s?.schoolYear, sy));
                return { success: true, data: scoped.length, message: result.message ?? "", error: result.error };
            } catch {
                return {
                    success: result.success,
                    data: result.data,
                    message: result.message ?? "",
                    error: result.error
                };
            }
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

    /** Verrou : paiements récents scopés sur l'année du login (tag "Cette année"). */
    async getRecentPayments(limit: number = 5, schoolYear?: string): Promise<ResultType> {
        try {
            const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
            const { matchesSchoolYearValue } = await import("../lib/schoolYear");
            const sy = await resolveTargetSchoolYear(schoolYear);
            const dataSource = AppDataSource.getInstance();
            const paymentRepo = dataSource.getRepository(PaymentEntity);
            const payments = await paymentRepo.find({
                relations: ['student'],
                order: { created_at: 'DESC' },
                take: Math.max(limit * 3, limit + 10)
            });
            const scoped = payments.filter((p: unknown) =>
                matchesSchoolYearValue((p as { schoolYear?: unknown })?.schoolYear, sy)
            ).slice(0, limit);

            const formattedPayments: IRecentPayment[] = scoped.map(payment => ({
                id: payment.id,
                studentName: `${payment.student.firstname} ${payment.student.lastname}`,
                amount: payment.amount,
                date: payment.created_at
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

    /** Verrou : courbe "Cette année" scopée sur l'année scolaire du login (pas 6 mois civils toutes années). */
    async getPaymentStats(schoolYear?: string): Promise<ResultType> {
        try {
            const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
            const { matchesSchoolYearValue, schoolYearMatchValues } = await import("../lib/schoolYear");
            const sy = await resolveTargetSchoolYear(schoolYear);
            const sys = schoolYearMatchValues(sy);
            const dataSource = AppDataSource.getInstance();
            const paymentRepo = dataSource.getRepository(PaymentEntity);
            
            const lastSixMonths = new Date();
            lastSixMonths.setMonth(lastSixMonths.getMonth() - 6);

            const payments = await paymentRepo
                .createQueryBuilder('payment')
                .where('payment.created_at >= :startDate', { startDate: lastSixMonths })
                .andWhere('payment.created_at <= :endDate', { endDate: new Date() })
                .andWhere('(payment.schoolYear IS NULL OR payment.schoolYear IN (:...sys))', { sys })
                .orderBy('payment.created_at', 'ASC')
                .getMany();
            // Filet mémoire (lignes legacy) : conserve ce qui matche le canon.
            const scoped = payments.filter((p: unknown) =>
                matchesSchoolYearValue((p as { schoolYear?: unknown })?.schoolYear, sy)
            );

            const monthlyPayments = scoped.reduce((acc: { [key: string]: number }, payment:any) => {
                    const month = new Date(payment.created_at).toLocaleString('fr-FR', { month: 'long' });
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

    async getRecentProfessorPayments(limit: number = 5): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const professorPaymentRepo = dataSource.getRepository(ProfessorPaymentEntity);
            const payments = await professorPaymentRepo.find({
                relations: ['professor'],
                order: { created_at: 'DESC' },
                take: limit
            });

            const formattedPayments: IProfessorRecentPayment[] = payments.map(payment => ({
                id: payment.id,
                professorName: `${payment.professor.firstname} ${payment.professor.lastname}`,
                amount: payment.amount,
                date: payment.created_at || payment.createdAt
            }));

            return {
                success: true,
                data: formattedPayments,
                message: "Paiements profs récents récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements profs récents",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getProfessorPaymentStats(): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const professorPaymentRepo = dataSource.getRepository(ProfessorPaymentEntity);

            const lastSixMonths = new Date();
            lastSixMonths.setMonth(lastSixMonths.getMonth() - 6);

            const payments = await professorPaymentRepo
                .createQueryBuilder('payment')
                .where('payment.created_at >= :startDate', { startDate: lastSixMonths })
                .andWhere('payment.created_at <= :endDate', { endDate: new Date() })
                .orderBy('payment.created_at', 'ASC')
                .getMany();

            const monthlyPayments = payments.reduce((acc: { [key: string]: number }, payment:any) => {
                    const month = new Date(payment.created_at || payment.createdAt).toLocaleString('fr-FR', { month: 'long' });
                acc[month] = (acc[month] || 0) + payment.amount;
                return acc;
            }, {});

            return {
                success: true,
                data: monthlyPayments,
                message: "Statistiques de paiement profs récupérées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques de paiement profs",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getRecentAbsences(limit: number = 5): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            
            const absences = await absenceRepo
                .createQueryBuilder('absence')
                .leftJoinAndSelect('absence.student', 'student')
                .leftJoinAndSelect('absence.professor', 'professor')
                .leftJoinAndSelect('absence.grade', 'grade')
                .leftJoinAndSelect('absence.course', 'course')
                .orderBy('absence.date', 'DESC')
                .addOrderBy('absence.created_at', 'DESC')
                .take(limit)
                .getMany();

            const formattedAbsences: IRecentAbsence[] = absences.map(absence => {
                const isProfessor = absence.type === 'PROFESSOR';
                const name = isProfessor
                    ? (absence.professor ? `${absence.professor.firstname} ${absence.professor.lastname}` : 'Professeur inconnu')
                    : (absence.student ? `${absence.student.firstname} ${absence.student.lastname}` : 'Inconnu');
                const className = absence.grade?.name || (absence.course?.name || (isProfessor ? 'Professeur' : 'N/A'));
                return {
                    id: absence.id,
                    studentName: name,
                    className: className,
                    date: absence.date,
                    absenceType: absence.absenceType,
                    justified: absence.justified,
                    type: absence.type
                } as IRecentAbsence;
            });

            return {
                success: true,
                data: formattedAbsences,
                message: "Absences récentes récupérées avec succès",
                error: null
            };
        } catch (error) {
            logger.error("Erreur getRecentAbsences:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des absences récentes",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getAbsenceStats(): Promise<ResultType> {
        try {
            logger.debug('=== Service Dashboard - Début getAbsenceStats ===');
            
            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            
            const lastThreeMonths = new Date();
            lastThreeMonths.setMonth(lastThreeMonths.getMonth() - 3);
            lastThreeMonths.setHours(0,0,0,0);

            const absences = await absenceRepo
                .createQueryBuilder('absence')
                .leftJoinAndSelect('absence.grade', 'grade')
                .leftJoinAndSelect('absence.student', 'student')
                .leftJoinAndSelect('absence.professor', 'professor')
                .where('absence.date >= :startDate', { startDate: lastThreeMonths.toISOString().split('T')[0] })
                .andWhere('absence.date <= :endDate', { endDate: new Date().toISOString().split('T')[0] })
                .getMany();

            logger.debug('Types des absences trouvées:', absences.map((a:any) => a.type));

            const absenceStats: IAbsenceStats = { student: {}, professor: {} };

            absences.forEach((absence:any) => {
                if (absence.type === 'STUDENT' && absence.grade?.name) {
                    const gradeName = absence.grade.name;
                    absenceStats.student[gradeName] = (absenceStats.student[gradeName] || 0) + 1;
                } else if (absence.type === 'PROFESSOR') {
                    if (absence.professor?.firstname || absence.professor?.lastname) {
                        const profName = `${absence.professor.firstname || ''} ${absence.professor.lastname || ''}`.trim() || `Prof #${absence.professor.id}`;
                        absenceStats.professor[profName] = (absenceStats.professor[profName] || 0) + 1;
                    } else {
                        absenceStats.professor['Professeurs'] = (absenceStats.professor['Professeurs'] || 0) + 1;
                    }
                }
            });

            logger.debug('Statistiques calculées:', absenceStats);

            return {
                success: true,
                data: absenceStats,
                message: "Statistiques d'absence récupérées avec succès",
                error: null
            };
        } catch (error) {
            logger.error("Erreur détaillée dans getAbsenceStats:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques d'absence",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getStats(schoolYear?: string): Promise<IDashboardServiceResponse> {
        try {
            const [totalStudents, totalProfessors, totalClasses, recentPayments, recentProfessorPayments, recentAbsences] = 
                await Promise.all([
                    this.getTotalStudents(schoolYear),
                    this.getTotalProfessors(),
                    this.getTotalClasses(),
                    this.getRecentPayments(5, schoolYear),
                    this.getRecentProfessorPayments(5),
                    this.getRecentAbsences(5)
                ]);

            return {
                success: true,
                data: {
                    stats: {
                        totalStudents: totalStudents.data || 0,
                        totalProfessors: totalProfessors.data || 0,
                        totalClasses: totalClasses.data || 0,
                        recentPayments: recentPayments.data || [],
                        recentProfessorPayments: recentProfessorPayments.data || [],
                        recentAbsences: recentAbsences.data || []
                    }
                },
                message: "Statistiques récupérées avec succès",
                error: null
            };
        } catch (error) {
            logger.error('Erreur lors de la récupération des statistiques:', error);
            return {
                success: false,
                data: {
                    stats: {
                        totalStudents: 0,
                        totalProfessors: 0,
                        totalClasses: 0,
                        recentPayments: [],
                        recentProfessorPayments: [],
                        recentAbsences: []
                    }
                },
                message: "Erreur lors de la récupération des statistiques",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
} 