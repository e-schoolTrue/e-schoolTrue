import { Repository } from "typeorm";
import { StudentEntity } from "../entities/students";
import { GradeEntity } from "../entities/grade";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { FileService } from "./fileService";
import { DashboardService } from "./dashboardService";
import { SchoolService } from "./schoolService";
import { PaymentService } from "./paymentService";
import {
    IStudentDetails,
    IStudentServiceParams,
    IStudentServiceResponse,
    IStudentCountResponse} from "../types/student";

export class StudentService {
    private studentRepository: Repository<StudentEntity>;
    private gradeRepository: Repository<GradeEntity>;
    private fileService: FileService;
    private dashboardService: DashboardService;
    private schoolService: SchoolService;
    private paymentService: PaymentService;

    // Mapper pour les détails d'un étudiant
    private mapToIStudentDetails(student: StudentEntity): IStudentDetails {
        return {
            ...student,
            photo: student.photo ? {
                id: student.photo.id,
                name: student.photo.name,
                type: student.photo.type
            } : null,
            documents: student.documents?.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: doc.type
            })) || [],
            grade: student.grade?.id ? {
                id: student.grade.id,
                name: student.grade.name || undefined,
                code: student.grade.code || undefined,
                description: undefined
            } : null
        };
    }

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.studentRepository = dataSource.getRepository(StudentEntity);
        this.gradeRepository = dataSource.getRepository(GradeEntity);
        this.fileService = new FileService();
        this.dashboardService = new DashboardService();
        this.schoolService = new SchoolService();
        this.paymentService = new PaymentService();
    }

    // Créer un étudiant
    async createStudent(studentData: IStudentServiceParams['createStudent']): Promise<IStudentServiceResponse> {
        try {
            // Vérification de la classe (grade)
            const grade = studentData.gradeId
                ? await this.gradeRepository.findOne({
                    where: { id: studentData.gradeId },
                })
                : null;

            if (studentData.gradeId && !grade) {
                return {
                    success: false,
                    data: null,
                    error: "Classe non trouvée",
                    message: "La classe spécifiée n'existe pas.",
                };
            }

            // Vérification des champs obligatoires
            if (!studentData.firstname || !studentData.lastname ) {
                return {
                    success: false,
                    data: null,
                    message: "Les informations obligatoires sont manquantes.",
                    error: "Champs obligatoires manquants : prénom, nom, prénom du père, nom du père.",
                };
            }

            // Vérifier si l'étudiant existe déjà
            const existingStudent = await this.studentRepository.findOne({
                where: {
                    firstname: studentData.firstname?.trim(),
                    lastname: studentData.lastname?.trim(),
                    birthDay: studentData.birthDay
                }
            });

            if (existingStudent) {
                return {
                    success: false,
                    data: null,
                    message: "Un étudiant avec ces informations existe déjà.",
                    error: "DUPLICATE_STUDENT",
                };
            }

            // Récupérer les informations de l'école pour le matricule
            const schoolInfo = await this.schoolService.getSchool();
            const schoolName = schoolInfo.data?.name || undefined;

            // Utilisation de la transaction pour garantir l'intégrité des données
            const dataSource = AppDataSource.getInstance();
            const result = await dataSource.manager.transaction(async transactionalEntityManager => {
                // Créer l'étudiant
                const student = this.studentRepository.create({
                    ...studentData,
                    isNew: studentData.isNew !== false,
                    grade: grade || undefined,
                });

                // Générer le matricule personnalisé
                student.matricule = StudentEntity.generateMatricule(schoolName);

                // Sauvegarde de la photo de l'étudiant
                if (studentData.photo) {
                    const savedPhoto = await this.fileService.saveFile({
                        content: studentData.photo.content || '',
                        name: studentData.photo.name,
                        type: studentData.photo.type
                    });
                    student.photo = savedPhoto;
                }

                // Sauvegarder l'étudiant
                const savedStudent = await transactionalEntityManager.save(student);

                // Sauvegarder les documents de l'étudiant
                const documents = studentData.documents || [];
                if (documents.length > 0) {
                    const savedDocuments = await Promise.all(
                        documents.map(doc =>
                            this.fileService.saveFile({
                                content: doc.content || '',
                                name: doc.name,
                                type: doc.type
                            })
                        )
                    );

                    // Associer les documents à l'étudiant
                    savedStudent.documents = savedDocuments;
                    await transactionalEntityManager.save(savedStudent);
                }

                // Récupérer l'étudiant avec toutes ses relations
                const completeStudent = await transactionalEntityManager.findOne(StudentEntity, {
                    where: { id: savedStudent.id },
                    relations: ['photo', 'documents', 'grade']
                });

                return completeStudent;
            });

            if (result) {
                await this.paymentService.createInitialInscriptionFee(result);
            }

            // Mise à jour des statistiques du tableau de bord
            await this.dashboardService.getStats();

            return {
                success: true,
                data: result ? this.mapToIStudentDetails(result) : null,
                message: "Étudiant créé avec succès",
                error: null,
            };
        } catch (error) {
            console.error("Erreur dans createStudent:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création de l'étudiant",
                error: error instanceof Error ? error.message : "Erreur inconnue",
            };
        }
    }

    // Récupérer tous les étudiants
    async getAllStudents(options: {
        page: number;
        pageSize: number;
        filters: {
            studentFullName?: string;
            grade?: number;
            schoolYear?: string;
        }
    }): Promise<{ students: StudentEntity[], total: number }> {
        try {
            const { page, pageSize, filters } = options;
            const qb = this.studentRepository.createQueryBuilder("student")
                .leftJoinAndSelect("student.photo", "photo")
                .leftJoinAndSelect("student.documents", "documents")
                .leftJoinAndSelect("student.grade", "grade");

            if (filters.studentFullName) {
                const searchName = `%${filters.studentFullName.toLowerCase()}%`;
                qb.where("LOWER(student.firstname || ' ' || student.lastname) LIKE :searchName", { searchName });
            }

            if (filters.grade) {
                qb.andWhere("student.grade.id = :gradeId", { gradeId: filters.grade });
            }

            if (filters.schoolYear) {
                const { schoolYearMatchValues } = await import("../lib/schoolYear");
                // Rétro-compat legacy : les lignes historiques stockent '2026'
                // alors que le filtre est normalisé en '2026-2027' → matcher les deux.
                const sys = schoolYearMatchValues(filters.schoolYear);
                qb.andWhere("student.schoolYear IN (:...sys)", { sys });
            }

            const [students, total] = await qb
                .skip((page - 1) * pageSize)
                .take(pageSize)
                .getManyAndCount();

            return { students, total };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue";
            console.error("Erreur détaillée dans getAllStudents:", error);
            throw new Error("Erreur lors de la récupération des étudiants: " + errorMessage);
        }
    }

    // Récupérer les détails d'un étudiant
    async getStudentDetails(studentId: number): Promise<IStudentServiceResponse> {
        try {
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['photo', 'documents', 'grade']
            });

            if (!student) {
                return {
                    success: false,
                    data: null,
                    error: "Étudiant non trouvé",
                    message: "Aucun étudiant trouvé avec cet identifiant.",
                };
            }

            const studentDetails: IStudentDetails = {
                ...student,
                photo: student.photo ? {
                    id: student.photo.id,
                    name: student.photo.name,
                    type: student.photo.type
                } : null,
                documents: student.documents ? student.documents.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    type: doc.type
                })) : [],
                grade: student.grade?.id ? {
                    id: student.grade.id,
                    name: student.grade.name || undefined,
                    code: student.grade.code || undefined,
                    description: undefined
                } : null
            };

            return {
                success: true,
                data: studentDetails,
                message: "Détails de l'étudiant récupérés avec succès.",
                error: null,
            };
        } catch (error) {
            console.error("Erreur détaillée dans getStudentDetails:", error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la récupération des détails de l'étudiant.",
            };
        }
    }

    // Mettre à jour un étudiant
    // B1: garde année interne — tout update touchant schoolYear|gradeId passe par
    // requireYearWritable (fail-closed si année clôturée). Le canal IPC
    // `update-student` porte en plus requireYearWrite (events.ts).
    async updateStudent(id: number, studentData: IStudentServiceParams['updateStudent']['data']): Promise<IStudentServiceResponse> {
        try {
            const existingStudent = await this.studentRepository.findOne({
                where: { id },
                relations: ["photo", "documents", "grade"],
            });

            if (!existingStudent) {
                return {
                    success: false,
                    data: null,
                    error: "Étudiant non trouvé",
                    message: "L'étudiant à mettre à jour n'existe pas"
                };
            }

            const { gradeId, ...otherData } = studentData as any;
            const touchesYear = (otherData as any)?.schoolYear != null || gradeId != null;
            if (touchesYear) {
                try {
                    const { requireYearWritable } = await import("../lib/yearGuard");
                    const { normalizeSchoolYear } = await import("../lib/schoolYear");
                    const rawYear = (otherData as any)?.schoolYear ?? (existingStudent as any)?.schoolYear;
                    const canon = normalizeSchoolYear(rawYear) ?? (typeof rawYear === "string" ? rawYear : undefined);
                    await requireYearWritable({ schoolYear: canon });
                } catch (e: any) {
                    const msg = String(e?.message ?? e);
                    if (/YEAR_CLOSED/.test(msg)) {
                        return { success: false, data: null, error: msg, message: "Année scolaire clôturée : écriture refusée" };
                    }
                    throw e;
                }
            }
            const isReEnrollment = gradeId && existingStudent.grade?.id !== gradeId;

            // Mettre à jour les données de l'étudiant
            Object.assign(existingStudent, otherData);

            // Handle grade change and re-enrollment
            if (isReEnrollment) {
                const grade = await this.gradeRepository.findOne({ where: { id: gradeId } });
                if (grade) {
                    existingStudent.grade = grade;
                }
                existingStudent.isNew = false;
            }

            // Sauvegarde de la photo si elle existe
            if ((studentData as any).photo?.content) {
                const savedPhoto = await this.fileService.saveFile({
                    content: (studentData as any).photo.content,
                    name: (studentData as any).photo.name,
                    type: (studentData as any).photo.type
                });
                existingStudent.photo = savedPhoto;
            }

            // Sauvegarder les nouveaux documents
            const documents = (studentData as any).documents || [];
            if (documents.length > 0) {
                const newDocuments = await Promise.all(
                    documents.map((doc: any) =>
                        this.fileService.saveFile({
                            content: doc.content || '',
                            name: doc.name,
                            type: doc.type
                        })
                    )
                );
                existingStudent.documents = [...(existingStudent.documents || []), ...newDocuments];
            }

            const updatedStudent = await this.studentRepository.save(existingStudent);

            if (isReEnrollment) {
                // B1: changement de grade = réinscription → frais de RÉINSCRIPTION
                // idempotents (jamais createInitial). Délègue au chemin canonique.
                try {
                    const { normalizeSchoolYear } = await import("../lib/schoolYear");
                    const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
                    const raw = (otherData as any)?.schoolYear ?? (updatedStudent as any)?.schoolYear;
                    const canon = normalizeSchoolYear(raw) ?? await resolveTargetSchoolYear();
                    (updatedStudent as any).schoolYear = canon;
                    await this.studentRepository.save(updatedStudent as any).catch(() => null);
                    await this.paymentService.createReInscriptionFee(updatedStudent.id, canon);
                } catch (e) {
                    console.warn("[updateStudent] createReInscriptionFee ignoré:", e);
                }
            }

            return {
                success: true,
                data: this.mapToIStudentDetails(updatedStudent),
                message: "Étudiant mis à jour avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour de l'étudiant",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Supprimer un étudiant
  async deleteStudent(studentId: number): Promise<IStudentServiceResponse> {
    try {
        const studentRepo = this.studentRepository;
        const student = await studentRepo.findOne({ where: { id: studentId } });

        if (!student) {
            return {
                success: false,
                data: null,
                error: "Étudiant introuvable",
                message: "Impossible de supprimer : étudiant introuvable"
            };
        }

        await studentRepo.remove(student); // Cela déclenchera les cascades automatiquement

        await this.dashboardService.getStats();

        return {
            success: true,
            data: null,
            error: null,
            message: "Étudiant supprimé avec succès"
        };
    } catch (error) {
        console.error("Erreur lors de la suppression de l'étudiant:", error);
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Erreur inconnue",
            message: "Erreur lors de la suppression de l'étudiant"
        };
    }
}


    // Récupérer un étudiant par son ID
    async getStudentById(id: number): Promise<ResultType> {
        try {
            const student = await this.studentRepository.findOne({
                where: { id },
                relations: ['grade', 'photo']
            });

            if (!student) {
                return {
                    success: false,
                    data: null,
                    error: "Étudiant non trouvé",
                    message: "L'étudiant demandé n'existe pas"
                };
            }

            return {
                success: true,
                data: student,
                error: null,
                message: "Étudiant récupéré avec succès"
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la récupération de l'étudiant"
            };
        }
    }

    // Obtenir le total des étudiants
    async getTotalStudents(): Promise<IStudentCountResponse> {
        try {
            const total = await this.studentRepository.count();
            return {
                success: true,
                data: total,
                message: "Nombre total d'étudiants récupéré avec succès",
                error: null
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

    async searchStudents(searchTerm: string): Promise<IStudentServiceResponse> {
        try {
            const students = await this.studentRepository
                .createQueryBuilder("student")
                .leftJoinAndSelect("student.photo", "photo")
                .leftJoinAndSelect("student.documents", "documents")
                .leftJoinAndSelect("student.grade", "grade")
                .where("student.firstname LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
                .orWhere("student.lastname LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
                .orWhere("student.fatherFirstname LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
                .orWhere("student.fatherLastname LIKE :searchTerm", { searchTerm: `%${searchTerm}%` })
                .getMany();

            return {
                success: true,
                data: students.map(student => this.mapToIStudentDetails(student)),
                message: "Recherche d'étudiants effectuée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la recherche d'étudiants",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getStudentsByGrade(gradeId: number): Promise<IStudentServiceResponse> {
        try {
            const students = await this.studentRepository.find({
                where: { grade: { id: gradeId } },
                relations: ["photo", "documents", "grade"]
            });

            return {
                success: true,
                data: students.map(student => this.mapToIStudentDetails(student)),
                message: "Étudiants récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des étudiants par classe",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /** Résout le niveau cible : gradeId explicite > nextGradeId > order+1. */
    private async resolveNextGrade(currentGradeId: number | undefined, explicitGradeId?: number): Promise<GradeEntity | null> {
        if (explicitGradeId) {
            return await this.gradeRepository.findOne({ where: { id: explicitGradeId } });
        }
        if (currentGradeId == null) return null;
        const current: any = await this.gradeRepository.findOne({ where: { id: currentGradeId } });
        if (!current) return null;
        if (current.nextGradeId) {
            const nxt = await this.gradeRepository.findOne({ where: { id: Number(current.nextGradeId) } });
            if (nxt) return nxt;
        }
        if (current.order != null) {
            const nxt = await this.gradeRepository.findOne({ where: { order: Number(current.order) + 1 } as any });
            if (nxt) return nxt;
        }
        return null;
    }

    /**
     * Réinscription : UPDATE grade/schoolYear/isNew=false + frais de réinscription idempotents.
     * Ne touche jamais aux notes/absences/paiements historiques.
     * B4: student save + frais dans UNE SEULE ds.transaction (atomicité).
     */
    async reEnrollStudent(studentId: number, opts: { schoolYear: string; gradeId?: number }): Promise<IStudentServiceResponse> {
        try {
            const { normalizeSchoolYear } = await import("../lib/schoolYear");
            const canon = normalizeSchoolYear(opts.schoolYear);
            if (!canon) return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "Année scolaire invalide (attendu YYYY-YYYY)" };
            const student = await this.studentRepository.findOne({ where: { id: studentId }, relations: ["grade"] });
            if (!student) return { success: false, data: null, error: "Étudiant non trouvé", message: "Étudiant introuvable" };
            // Refuse la réinscription vers une année clôturée
            try {
                const { requireYearWritable } = await import("../lib/yearGuard");
                await requireYearWritable({ schoolYear: canon });
            } catch (e: any) {
                return { success: false, data: null, error: String(e?.message ?? e), message: "Année scolaire clôturée" };
            }
            const targetGrade = await this.resolveNextGrade((student.grade as any)?.id, opts.gradeId);
            if (opts.gradeId && !targetGrade) return { success: false, data: null, error: "Classe non trouvée", message: "La classe cible n'existe pas." };
            if (targetGrade) student.grade = targetGrade as any;
            (student as any).schoolYear = canon;
            (student as any).isNew = false;
            // B4: une seule transaction — le save étudiant et la création du frais
            // de réinscription partagent le même EntityManager (pas de double-tx).
            const ds = AppDataSource.getInstance();
            const useTx = typeof (ds as any)?.transaction === "function";
            if (useTx) {
                await (ds as any).transaction(async (manager: any) => {
                    const sRepo = manager.getRepository(StudentEntity);
                    const saved = await sRepo.save(student);
                    // createReInscriptionFee accepte un manager externe pour rester
                    // dans la même tx (sinon il ouvre sa propre tx — repli toléré).
                    await (this.paymentService as any).createReInscriptionFee(saved.id, canon, manager);
                });
            } else {
                const saved = await this.studentRepository.save(student);
                await this.paymentService.createReInscriptionFee(saved.id, canon);
            }
            const full = await this.studentRepository.findOne({ where: { id: studentId }, relations: ["photo", "documents", "grade"] });
            return { success: true, data: full ? this.mapToIStudentDetails(full) : null, message: `Élève réinscrit en ${canon}`, error: null };
        } catch (error) {
            return { success: false, data: null, message: "Erreur lors de la réinscription", error: error instanceof Error ? error.message : "Erreur inconnue" };
        }
    }

    async batchReEnroll(studentIds: number[], opts: { schoolYear: string; gradeId?: number }): Promise<IStudentServiceResponse> {
        try {
            // B4: continue sur échec + bilan {ok, failed} (jamais de return au 1er échec).
            const details: any[] = [];
            let ok = 0;
            let failed = 0;
            for (const id of studentIds) {
                try {
                    const r = await this.reEnrollStudent(id, opts);
                    details.push({ id, ...r });
                    if (r.success) ok += 1;
                    else failed += 1;
                } catch (e) {
                    failed += 1;
                    details.push({ id, success: false, data: null, message: "Erreur réinscription", error: e instanceof Error ? e.message : String(e) });
                }
            }
            const success = failed === 0;
            return {
                success,
                data: { ok, failed, results: details } as any,
                message: success
                    ? `${ok} réinscription(s) effectuée(s)`
                    : `${ok} réussite(s), ${failed} échec(s) sur ${details.length}`,
                error: success ? null : "BATCH_PARTIAL",
            };
        } catch (error) {
            return { success: false, data: null, message: "Erreur réinscriptions en lot", error: error instanceof Error ? error.message : "Erreur inconnue" };
        }
    }
}

