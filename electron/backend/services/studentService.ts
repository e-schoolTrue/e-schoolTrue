import { Repository } from "typeorm";
import { StudentEntity } from "../entities/students";
import { ParentEntity } from "../entities/parents";
import { GradeEntity } from "../entities/grade";
import { AppDataSource } from "../../data-source";
import { normalizeName, normalizePhone, parentNameKey } from "../utils/normalize";
import { PreferenceEntity } from "../entities/preference";

/** Option B Table Parent — mode de double-écriture (réglage `USE_PARENT_TABLE`). */
export type ParentTableMode = "off" | "shadow" | "on";

export interface ParentDto {
    fatherFirstname?: string | null;
    fatherLastname?: string | null;
    motherFirstname?: string | null;
    motherLastname?: string | null;
    /** Typo historique `famillyPhone` (2L) conservée. */
    famillyPhone?: string | null;
    address?: string | null;
}

/**
 * Suggestion foyer (contrat IPC `parent:search` / `student:parents:search`,
 * consommé par `src/types/student.ts` → `IParentSuggestion`).
 */
export interface IParentSuggestion {
    id: number;
    label: string;
    noms?: string;
    fatherFirstname?: string;
    fatherLastname?: string;
    motherFirstname?: string;
    motherLastname?: string;
    famillyPhone?: string;
    address?: string;
    usageCount?: number;
}

const PARENT_FIELDS = [
    "fatherFirstname",
    "fatherLastname",
    "motherFirstname",
    "motherLastname",
    "famillyPhone",
    "address",
] as const;

/** Libellé lisible d'un foyer : `"Père Prénom Nom & Mère Prénom Nom (tél)"`. */
export function buildParentLabel(p: {
    id?: number;
    fatherFirstname?: string | null;
    fatherLastname?: string | null;
    motherFirstname?: string | null;
    motherLastname?: string | null;
    famillyPhone?: string | null;
}): string {
    const father = `${String(p.fatherFirstname ?? "").trim()} ${String(p.fatherLastname ?? "").trim()}`.trim();
    const mother = `${String(p.motherFirstname ?? "").trim()} ${String(p.motherLastname ?? "").trim()}`.trim();
    const parts = [father, mother].filter((v) => v !== "");
    const base = parts.length > 0 ? parts.join(" & ") : `Foyer #${p.id ?? "?"}`;
    const phone = String(p.famillyPhone ?? "").trim();
    return phone !== "" ? `${base} (${phone})` : base;
}

const isUniqueViolation = (e: unknown): boolean =>
    /SQLITE_CONSTRAINT|UNIQUE|unique/i.test(String((e as Error)?.message ?? e ?? ""));
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

    // ============================================================
    // Option B Table Parent — foyer (T_parent), phase Expand.
    // - Double-écriture : `T_student` à-plat conservé, `parent` lié en plus.
    // - `USE_PARENT_TABLE` : `off` (100% à-plat) | `shadow` (défaut :
    //   écrit les deux, lit l'à-plat) | `on` (écrit les deux, lectures
    //   préférant le foyer quand lié). Stocké en `T_preference`.
    // - Sur-création > sur-fusion : P3 (`no-key`) jamais réutilisé,
    //   conflit tél à l'update = erreur (réassigner, jamais merger).
    // ============================================================
    private get parentRepo(): Repository<ParentEntity> {
        return AppDataSource.getInstance().getRepository(ParentEntity);
    }

    async getParentTableMode(): Promise<ParentTableMode> {
        try {
            const repo = AppDataSource.getInstance().getRepository(PreferenceEntity);
            const row = await repo.findOne({ where: { key: "USE_PARENT_TABLE" } });
            const v = String((row as PreferenceEntity | null)?.value ?? "shadow").trim().toLowerCase();
            if (v === "off" || v === "shadow" || v === "on") return v;
            return "shadow";
        } catch {
            return "shadow";
        }
    }

    async setParentTableMode(mode: ParentTableMode): Promise<ParentTableMode> {
        const v = mode === "off" || mode === "on" ? mode : "shadow";
        const repo = AppDataSource.getInstance().getRepository(PreferenceEntity);
        const existing = await repo.findOne({ where: { key: "USE_PARENT_TABLE" } }).catch(() => null);
        if (existing) {
            (existing as PreferenceEntity).value = v;
            await repo.save(existing as PreferenceEntity);
        } else {
            await repo.save(repo.create({ key: "USE_PARENT_TABLE", value: v } as PreferenceEntity));
        }
        return v;
    }

    private async hasParentTable(): Promise<boolean> {
        try {
            const ds = AppDataSource.getInstance();
            const qr = ds.createQueryRunner();
            try {
                return await qr.hasTable("T_parent");
            } finally {
                await qr.release();
            }
        } catch {
            return false;
        }
    }

    private hasParentPayload(dto: Record<string, unknown>): boolean {
        return PARENT_FIELDS.some((f) => {
            const v = dto[f];
            return v != null && String(v).trim() !== "";
        });
    }

    /**
     * Trouve ou crée le foyer correspondant au payload (UNIQUE `normalizedPhone`
     * + retry `SQLITE_CONSTRAINT` contre les races ; P2 par quadruplet exact ;
     * P3 `no-key` = 1 foyer par appel, jamais réutilisé).
     * Retourne `null` si le payload ne porte aucune info parent.
     */
    async findOrCreateParent(dto: ParentDto): Promise<ParentEntity | null> {
        const ff = String(dto.fatherFirstname ?? "").trim();
        const fl = String(dto.fatherLastname ?? "").trim();
        const mf = String(dto.motherFirstname ?? "").trim();
        const ml = String(dto.motherLastname ?? "").trim();
        const rawPhone = String(dto.famillyPhone ?? "").trim();
        const address = dto.address != null && String(dto.address).trim() !== ""
            ? String(dto.address).trim()
            : null;
        const hasName = [ff, fl, mf, ml].some((v) => v !== "");
        if (!hasName && rawPhone === "" && address == null) return null;
        if (!(await this.hasParentTable())) return null;

        const repo = this.parentRepo;
        const np = normalizePhone(rawPhone === "" ? null : rawPhone);
        void normalizeName;

        // P1 : clé téléphone.
        if (np != null) {
            const existing = await repo.findOne({ where: { normalizedPhone: np } }).catch(() => null);
            if (existing) return existing;
            try {
                return await repo.save(repo.create({
                    fatherFirstname: ff,
                    fatherLastname: fl,
                    motherFirstname: mf,
                    motherLastname: ml,
                    famillyPhone: rawPhone === "" ? null : rawPhone,
                    normalizedPhone: np,
                    address,
                    suspect: null,
                    remote_id: null,
                } as ParentEntity));
            } catch (e) {
                // Race : un autre thread a inséré le même tél → réutiliser.
                if (isUniqueViolation(e)) {
                    const retry = await repo.findOne({ where: { normalizedPhone: np } }).catch(() => null);
                    if (retry) return retry;
                }
                throw e;
            }
        }

        // P3 : aucune clé → orphelin, JAMAIS fusionné (1 foyer par élève).
        const key = parentNameKey(ff, fl, mf, ml);
        if (key === "|||") {
            return await repo.save(repo.create({
                fatherFirstname: ff,
                fatherLastname: fl,
                motherFirstname: mf,
                motherLastname: ml,
                famillyPhone: rawPhone === "" ? null : rawPhone,
                normalizedPhone: null,
                address,
                suspect: "no-key",
                remote_id: null,
            } as ParentEntity));
        }

        // P2 : quadruplet exact (comparaison normalisée en JS : la casse et
        // les accents ne doivent pas créer de doublons).
        const candidates = await repo
            .createQueryBuilder("p")
            .where("p.normalizedPhone IS NULL")
            .andWhere("(p.suspect IS NULL OR p.suspect != 'no-key')")
            .getMany()
            .catch(() => [] as ParentEntity[]);
        const hit = (candidates ?? []).find(
            (c) => parentNameKey(c.fatherFirstname, c.fatherLastname, c.motherFirstname, c.motherLastname) === key,
        );
        if (hit) return hit;
        return await repo.save(repo.create({
            fatherFirstname: ff,
            fatherLastname: fl,
            motherFirstname: mf,
            motherLastname: ml,
            famillyPhone: rawPhone === "" ? null : rawPhone,
            normalizedPhone: null,
            address,
            suspect: null,
            remote_id: null,
        } as ParentEntity));
    }

    /**
     * Résout la référence foyer pour un payload élève : `parentId` explicite
     * prioritaire, sinon `findOrCreateParent` si le payload porte des champs
     * parent et que le mode n'est pas `off`. Retourne `undefined` = ne rien
     * toucher (à-plat seul).
     */
    private async resolveParentForStudentPayload(
        dto: Record<string, unknown>,
    ): Promise<ParentEntity | null | undefined> {
        const mode = await this.getParentTableMode();
        if (mode === "off") return undefined;
        if (!(await this.hasParentTable())) return undefined;
        if (dto.parentId !== undefined) {
            if (dto.parentId == null) return null;
            const id = Number(dto.parentId);
            if (!Number.isFinite(id)) return undefined;
            const parent = await this.parentRepo.findOne({ where: { id } }).catch(() => null);
            return parent ?? undefined;
        }
        if (!this.hasParentPayload(dto)) return undefined;
        try {
            return await this.findOrCreateParent({
                fatherFirstname: dto.fatherFirstname as string | null,
                fatherLastname: dto.fatherLastname as string | null,
                motherFirstname: dto.motherFirstname as string | null,
                motherLastname: dto.motherLastname as string | null,
                famillyPhone: dto.famillyPhone as string | null,
                address: dto.address as string | null,
            });
        } catch (e) {
            // Fail-soft : un foyer ne doit jamais bloquer la création d'un élève
            // en phase Expand (l'à-plat reste la source de vérité).
            console.warn("[studentService] findOrCreateParent ignoré:", e);
            return undefined;
        }
    }

    /**
     * Recherche de foyers : LIKE insensible sur les 4 noms + `famillyPhone`,
     * exact sur `normalizedPhone` (la requête `q` est normalisée avant
     * comparaison). `q` >= 2 caractères, `limit` clampé 1..20.
     * Lève `QUERY_TOO_SHORT` si `q` est trop court.
     */
    async searchParents(q: string, limit = 10): Promise<IParentSuggestion[]> {
        const query = String(q ?? "").trim();
        if (query.length < 2) throw new Error("QUERY_TOO_SHORT: q >= 2 caractères requis");
        const take = Math.min(20, Math.max(1, Math.floor(Number(limit) || 10)));
        if (!(await this.hasParentTable())) return [];
        const esc = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);
        const like = `%${esc(query.toLowerCase())}%`;
        const phoneLike = `%${esc(query)}%`;
        const exactPhone = normalizePhone(query);
        const qb = this.parentRepo
            .createQueryBuilder("p")
            .leftJoin("p.students", "s")
            .addSelect("COUNT(s.id)", "usageCount")
            .where("LOWER(p.fatherFirstname) LIKE :like ESCAPE '\\'", { like })
            .orWhere("LOWER(p.fatherLastname) LIKE :like ESCAPE '\\'", { like })
            .orWhere("LOWER(p.motherFirstname) LIKE :like ESCAPE '\\'", { like })
            .orWhere("LOWER(p.motherLastname) LIKE :like ESCAPE '\\'", { like })
            .orWhere("p.famillyPhone LIKE :phoneLike ESCAPE '\\'", { phoneLike });
        if (exactPhone) qb.orWhere("p.normalizedPhone = :exactPhone", { exactPhone });
        const { entities, raw } = await qb
            .groupBy("p.id")
            .orderBy("usageCount", "DESC")
            .addOrderBy("p.updatedAt", "DESC")
            .take(take)
            .getRawAndEntities();
        return entities.map((p, i) => {
            const usageCount = Number((raw?.[i] as Record<string, unknown> | undefined)?.usageCount ?? 0);
            const father = `${String(p.fatherFirstname ?? "").trim()} ${String(p.fatherLastname ?? "").trim()}`.trim();
            const mother = `${String(p.motherFirstname ?? "").trim()} ${String(p.motherLastname ?? "").trim()}`.trim();
            const noms = [father, mother].filter((v) => v !== "").join(" & ");
            return {
                id: p.id,
                label: buildParentLabel(p),
                noms: noms === "" ? undefined : noms,
                fatherFirstname: p.fatherFirstname ?? undefined,
                fatherLastname: p.fatherLastname ?? undefined,
                motherFirstname: p.motherFirstname ?? undefined,
                motherLastname: p.motherLastname ?? undefined,
                famillyPhone: p.famillyPhone ?? undefined,
                address: p.address ?? undefined,
                usageCount,
            };
        });
    }

    async getParentById(id: number): Promise<(ParentEntity & { usageCount: number }) | null> {
        const parent = await this.parentRepo.findOne({ where: { id } }).catch(() => null);
        if (!parent) return null;
        let usageCount = 0;
        try {
            usageCount = await this.studentRepository.count({ where: { parent: { id } } as never });
        } catch {
            try {
                const rows = await AppDataSource.getInstance().query(
                    `SELECT COUNT(*) AS "n" FROM "T_student" WHERE "parentId" = ?`,
                    [id],
                );
                usageCount = Number(rows?.[0]?.n ?? 0);
            } catch {
                usageCount = 0;
            }
        }
        return { ...(parent as ParentEntity), usageCount };
    }

    /**
     * Met à jour un foyer (champs à-plat + adresse + tél). Le téléphone est
     * re-normalisé ; conflit avec un AUTRE foyer → `PARENT_PHONE_CONFLICT`
     * (sur-création : réassigner les élèves, jamais merger implicitement).
     */
    async updateParent(
        id: number,
        patch: Partial<ParentDto>,
    ): Promise<{ success: boolean; data: ParentEntity | null; error: string | null; message: string }> {
        try {
            const parent = await this.parentRepo.findOne({ where: { id } });
            if (!parent) {
                return { success: false, data: null, error: "NOT_FOUND", message: "Foyer introuvable" };
            }
            const next = { ...parent };
            for (const f of ["fatherFirstname", "fatherLastname", "motherFirstname", "motherLastname"] as const) {
                if (patch[f] !== undefined) next[f] = String(patch[f] ?? "").trim();
            }
            if (patch.famillyPhone !== undefined) {
                const rawPhone = String(patch.famillyPhone ?? "").trim();
                const np = normalizePhone(rawPhone === "" ? null : rawPhone);
                if (np != null) {
                    const clash = await this.parentRepo.findOne({ where: { normalizedPhone: np } }).catch(() => null);
                    if (clash && Number(clash.id) !== Number(id)) {
                        return {
                            success: false,
                            data: null,
                            error: "PARENT_PHONE_CONFLICT",
                            message: `Téléphone déjà rattaché au foyer #${clash.id} : réassignez les élèves au lieu de fusionner`,
                        };
                    }
                    next.famillyPhone = rawPhone === "" ? null : rawPhone;
                    next.normalizedPhone = np;
                } else {
                    next.famillyPhone = rawPhone === "" ? null : rawPhone;
                    // `NULL` jamais `''`.
                    next.normalizedPhone = null;
                }
            }
            if (patch.address !== undefined) {
                next.address = patch.address != null && String(patch.address).trim() !== ""
                    ? String(patch.address).trim()
                    : null;
            }
            // Recalcule `suspect` : P3 ssi tél NULL + quadruplet vide.
            const key = parentNameKey(next.fatherFirstname, next.fatherLastname, next.motherFirstname, next.motherLastname);
            next.suspect = next.normalizedPhone == null && key === "|||" ? "no-key" : null;
            const saved = await this.parentRepo.save(next);
            return { success: true, data: saved, error: null, message: "Foyer mis à jour" };
        } catch (e) {
            if (isUniqueViolation(e)) {
                return {
                    success: false,
                    data: null,
                    error: "PARENT_PHONE_CONFLICT",
                    message: "Téléphone déjà rattaché à un autre foyer : réassignez les élèves au lieu de fusionner",
                };
            }
            return {
                success: false,
                data: null,
                error: e instanceof Error ? e.message : "Erreur inconnue",
                message: "Erreur lors de la mise à jour du foyer",
            };
        }
    }

    /**
     * Réassigne un élève à un foyer (`null` = détacher). Double-écriture :
     * les colonnes à-plat de l'élève sont recopiées depuis le foyer (Expand —
     * l'à-plat reste lisible sans jointure). Ne touche jamais aux autres élèves.
     */
    async reassignStudentParent(
        studentId: number,
        parentId: number | null,
    ): Promise<IStudentServiceResponse> {
        try {
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ["photo", "documents", "grade"],
            });
            if (!student) {
                return { success: false, data: null, error: "Étudiant non trouvé", message: "Étudiant introuvable" };
            }
            if (parentId != null) {
                const parent = await this.parentRepo.findOne({ where: { id: parentId } }).catch(() => null);
                if (!parent) {
                    return { success: false, data: null, error: "NOT_FOUND", message: "Foyer introuvable" };
                }
                (student as StudentEntity).parent = parent as ParentEntity;
                // Double-écriture à-plat (Expand).
                student.fatherFirstname = parent.fatherFirstname ?? "";
                student.fatherLastname = parent.fatherLastname ?? "";
                student.motherFirstname = parent.motherFirstname ?? "";
                student.motherLastname = parent.motherLastname ?? "";
                (student as Record<string, unknown>).famillyPhone = parent.famillyPhone ?? null;
                if (parent.address != null) student.address = parent.address;
            } else {
                (student as StudentEntity).parent = null;
            }
            const saved = await this.studentRepository.save(student);
            const full = await this.studentRepository.findOne({
                where: { id: saved.id },
                relations: ["photo", "documents", "grade"],
            });
            return {
                success: true,
                data: full ? this.mapToIStudentDetails(full) : null,
                message: parentId != null ? `Élève rattaché au foyer #${parentId}` : "Élève détaché de son foyer",
                error: null,
            };
        } catch (e) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la réassignation du foyer",
                error: e instanceof Error ? e.message : "Erreur inconnue",
            };
        }
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

            // Option B Table Parent : résolution foyer AVANT la transaction
            // (écriture foyer séparée ; fail-soft → `undefined` = à-plat seul).
            // Double-écriture : les champs à-plat de `studentData` sont conservés
            // tels quels, `parent` lie le foyer en plus (mode `off` = ignoré).
            const { parentId: _explicitParentId, ...studentFlat } = studentData as Record<string, unknown>;
            void _explicitParentId;
            const parentRef = await this.resolveParentForStudentPayload(studentData as Record<string, unknown>);

            // Utilisation de la transaction pour garantir l'intégrité des données
            const dataSource = AppDataSource.getInstance();
            const result = await dataSource.manager.transaction(async transactionalEntityManager => {
                // Créer l'étudiant
                const student = this.studentRepository.create({
                    ...studentFlat,
                    isNew: studentData.isNew !== false,
                    grade: grade || undefined,
                });
                if (parentRef !== undefined) {
                    (student as StudentEntity).parent = parentRef;
                }

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
            // Option B : `parentId` explicite retiré de l'assignation générique
            // (`@RelationId` non persisté — on passe par la relation `parent`).
            const { parentId: _nextParentId, ...flatUpdate } = otherData as Record<string, unknown>;
            void _nextParentId;
            Object.assign(existingStudent, flatUpdate);

            // Option B Table Parent (double-écriture, à-plat conservé) :
            // - `parentId` explicite (number|null) prioritaire ;
            // - sinon findOrCreate si des champs parent sont fournis (mode != off).
            try {
                const payload = { ...(flatUpdate as Record<string, unknown>), parentId: (otherData as Record<string, unknown>).parentId };
                const parentRef = await this.resolveParentForStudentPayload(payload);
                if (parentRef !== undefined) {
                    (existingStudent as StudentEntity).parent = parentRef;
                }
            } catch (e) {
                console.warn("[updateStudent] parent ignoré:", e);
            }

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

