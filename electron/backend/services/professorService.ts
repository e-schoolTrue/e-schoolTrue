import { AppDataSource } from "#electron/data-source";
import { logger } from "../utils/logger";
import { ProfessorEntity, DiplomaEntity, QualificationEntity } from "#electron/backend/entities/professor";
import { Repository, In } from "typeorm";
import { TeachingAssignmentEntity } from "../entities/teaching";
import { TEACHING_TYPE } from "#electron/command";
import { GradeEntity } from "../entities/grade";
import { CourseEntity } from "../entities/course";
import { FileService } from "#electron/backend/services/fileService";
import { DashboardService } from "#electron/backend/services/dashboardService";
import { SchoolService } from "#electron/backend/services/schoolService";
import {
    IProfessorServiceParams,
    IProfessorServiceResponse,
    IProfessorDetails,
    ITeachingAssignment
} from "../types/professor";
import { getCurrentSupabaseUserId } from "../lib/session";

export class ProfessorService {
    private professorRepository!: Repository<ProfessorEntity>;
    private diplomaRepository!: Repository<DiplomaEntity>;
    private qualificationRepository!: Repository<QualificationEntity>;
    private teachingAssignmentRepository!: Repository<TeachingAssignmentEntity>;
    private gradeRepository!: Repository<GradeEntity>;
    private courseRepository!: Repository<CourseEntity>;
    private fileService: FileService;
    private dashboardService: DashboardService;
    private schoolService: SchoolService;

    private mapToProfessorDetails(professor: ProfessorEntity): IProfessorDetails {
        // Créer l'objet résultat directement avec le type IProfessorDetails
        const mappedProfessor: IProfessorDetails = {
            id: professor.id,
            firstname: professor.firstname,
            lastname: professor.lastname,
            civility: professor.civility,
            nbr_child: professor.nbr_child,
            family_situation: professor.family_situation,
            birth_date: professor.birth_date,
            birth_town: professor.birth_town,
            address: professor.address,
            town: professor.town,
            cni_number: professor.cni_number,
            color: professor.color,
            photo: professor.photo ? {
                id: professor.photo.id,
                name: professor.photo.name,
                type: professor.photo.type
            } : undefined,
            documents: professor.documents?.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: doc.type
            })) || [],
            diploma: professor.diploma ? {
                id: professor.diploma.id,
                name: professor.diploma.name
            } : undefined,
            qualification: professor.qualification ? {
                id: professor.qualification.id,
                name: professor.qualification.name
            } : undefined,
            teaching: [] // Initialiser avec un tableau vide
        };
        
        logger.debug("Teaching data loaded", { count: professor.teaching?.length ?? 0 });
        
        if (professor.teaching && Array.isArray(professor.teaching) && professor.teaching.length > 0) {
            mappedProfessor.teaching = professor.teaching.map(teaching => {
                const mappedTeaching: ITeachingAssignment = {
                    id: teaching.id,
                    schoolType: teaching.schoolType === 'PRIMARY' ? 'PRIMARY' : 'SECONDARY'
                };
                
                if (teaching.class) {
                    const cid = Number(teaching.class.id);
                    if (Number.isFinite(cid) && cid > 0) {
                        mappedTeaching.class = {
                            id: cid,
                            name: String(teaching.class.name)
                        };
                    }
                }
                
                if (teaching.course) {
                    const crsId = Number(teaching.course.id);
                    if (Number.isFinite(crsId) && crsId > 0) {
                        mappedTeaching.course = {
                            id: crsId,
                            name: String(teaching.course.name),
                            coefficient: (teaching.course as any).coefficient != null ? Number((teaching.course as any).coefficient) : undefined
                        } as any;
                    }
                }
                
                // S'assurer que les grades sont correctement mappés
                if (teaching.grades && Array.isArray(teaching.grades) && teaching.grades.length > 0) {
                    const validGrades = teaching.grades
                        .map(grade => {
                            const gid = Number(grade.id);
                            if (!Number.isFinite(gid) || gid <= 0) return null;
                            return { id: gid, name: String(grade.name) };
                        })
                        .filter(Boolean) as { id: number; name: string }[];
                    if (validGrades.length > 0) {
                        mappedTeaching.grades = validGrades;
                        // Si c'est un enseignement secondaire, on définit aussi la classe principale
                        if (teaching.schoolType === 'SECONDARY' && validGrades.length > 0) {
                            mappedTeaching.class = {
                                id: validGrades[0].id,
                                name: String(validGrades[0].name)
                            };
                        }
                    }
                }

                // Mapping gradeIds / gradeNames for SECONDARY multi-classes (preserve original arrays)
                // teaching is TeachingAssignmentEntity which has gradeIds?: string and gradeNames?: string
                const legacyTeaching = teaching as TeachingAssignmentEntity;
                if (legacyTeaching.gradeIds) {
                    mappedTeaching.gradeIds = String(legacyTeaching.gradeIds);
                } else if (teaching.grades && Array.isArray(teaching.grades) && teaching.grades.length > 0) {
                    mappedTeaching.gradeIds = teaching.grades.map(g => String((g as GradeEntity).id)).join(',');
                }
                if (legacyTeaching.gradeNames) {
                    mappedTeaching.gradeNames = String(legacyTeaching.gradeNames);
                } else if (mappedTeaching.gradeIds && mappedTeaching.grades?.length) {
                    mappedTeaching.gradeNames = mappedTeaching.grades.map(g => g.name).join(', ');
                }
                
                return mappedTeaching;
            });
            
            logger.debug("Mapped teaching data", { count: mappedProfessor.teaching?.length ?? 0 });
        }
        
        return mappedProfessor;
    }

    constructor() {
        this.fileService = new FileService();
        this.dashboardService = new DashboardService();
        this.schoolService = new SchoolService();
    }

    private async ensureRepositoriesInitialized(): Promise<void> {
        try {
            const dataSource = AppDataSource.getInstance();
            if (!dataSource.isInitialized) {
                await AppDataSource.initialize(false);
            }
            
            this.professorRepository = dataSource.getRepository(ProfessorEntity);
            this.diplomaRepository = dataSource.getRepository(DiplomaEntity);
            this.qualificationRepository = dataSource.getRepository(QualificationEntity);
            this.teachingAssignmentRepository = dataSource.getRepository(TeachingAssignmentEntity);
            this.gradeRepository = dataSource.getRepository(GradeEntity);
            this.courseRepository = dataSource.getRepository(CourseEntity);
        } catch (error) {
            logger.error("Error initializing repositories:", error);
            throw error;
        }
    }

    async createProfessor(professorData: IProfessorServiceParams['createProfessor']): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const dataSource = AppDataSource.getInstance();

            // P1 early validation: SECONDARY requires at least courseId or gradeIds
            if (professorData.teaching?.schoolType === 'SECONDARY') {
                const vCourse: any = (professorData.teaching as any).courseId ?? (professorData.teaching as any).course?.id ?? (professorData.teaching as any).selectedCourse;
                const vGrade: any = (professorData.teaching as any).gradeIds ?? (professorData.teaching as any).selectedClasses ?? (professorData.teaching as any).gradeIds;
                const courseMissing = vCourse == null || String(vCourse).trim() === '' || !Number.isFinite(Number(vCourse)) || Number(vCourse) <= 0;
                const gradeEmpty = vGrade == null || (typeof vGrade === 'string' && vGrade.trim() === '') || (Array.isArray(vGrade) && vGrade.length === 0);
                if (courseMissing && gradeEmpty) {
                    return {
                        success: false,
                        data: null,
                        message: "Enseignement secondaire incomplet : courseId et gradeIds manquants. Veuillez fournir au moins une matière ou une classe.",
                        error: "VALIDATION_ERROR"
                    };
                }
            }

            // Récupérer les informations de l'école pour le matricule
            const schoolInfo = await this.schoolService.getSchool();
            const schoolName = schoolInfo.data?.name || undefined;
            const UserId = getCurrentSupabaseUserId();

            const result = await dataSource.manager.transaction(async transactionalEntityManager => {
                // Create or find diploma if provided
                let diploma;
                if (professorData.diploma) {
                    diploma = await transactionalEntityManager.findOne(DiplomaEntity, {
                        where: { name: professorData.diploma }
                    });
                    
                    if (!diploma) {
                        diploma = this.diplomaRepository.create({
                            name: professorData.diploma
                        });
                        diploma = await transactionalEntityManager.save(diploma);
                    }
                }

                // Create or find qualification if provided
                let qualification;
                if (professorData.qualification) {
                    qualification = await transactionalEntityManager.findOne(QualificationEntity, {
                        where: { name: professorData.qualification }
                    });
                    
                    if (!qualification) {
                        qualification = this.qualificationRepository.create({
                            name: professorData.qualification
                        });
                        qualification = await transactionalEntityManager.save(qualification);
                    }
                }

                const professor = this.professorRepository.create({
                    firstname: professorData.firstname,
                    lastname: professorData.lastname,
                    civility: professorData.civility,
                    nbr_child: professorData.nbr_child,
                    family_situation: professorData.family_situation,
                    birth_date: professorData.birth_date,
                    birth_town: professorData.birth_town,
                    address: professorData.address,
                    town: professorData.town,
                    cni_number: professorData.cni_number,
                    diploma: diploma || undefined,
                    qualification: qualification || undefined,
                    user_id: UserId
                });

                // Générer le matricule personnalisé
                professor.matricule = ProfessorEntity.generateMatricule(schoolName);
                if (professorData.color) {
                    professor.color = professorData.color;
                } else {
                    const palette = ['#409EFF','#67C23A','#E6A23C','#F56C6C','#909399','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#3B82F6','#14B8A6','#A855F7','#F97316','#06B6D4'];
                    try {
                        const count = await transactionalEntityManager.count(ProfessorEntity);
                        professor.color = palette[count % palette.length];
                    } catch { professor.color = '#409EFF'; }
                }

                // Handle photo upload
                if (professorData.photo && professorData.photo.content) {
                    const savedPhoto = await this.fileService.saveFile({
                        content: professorData.photo.content,
                        name: professorData.photo.name,
                        type: professorData.photo.type
                    });
                    professor.photo = savedPhoto;
                }

                // Handle documents upload
                if (professorData.documents && professorData.documents.length > 0) {
                    const validDocuments = professorData.documents.filter(doc => doc.content);
                    if (validDocuments.length > 0) {
                        const savedDocuments = await Promise.all(
                            validDocuments.map(doc => 
                                this.fileService.saveFile({
                                    content: doc.content!,
                                    name: doc.name,
                                    type: doc.type
                                })
                            )
                        );
                        professor.documents = savedDocuments;
                    }
                }

                const savedProfessor = await transactionalEntityManager.save(professor);

                // Handle teaching assignments
                if (professorData.teaching) {
                    logger.debug('Création affectation enseignement', { schoolType: professorData.teaching?.schoolType });

                    // P1 validation: SECONDARY requires at least courseId or gradeIds
                    if (professorData.teaching.schoolType === 'SECONDARY') {
                        const vCourse: any = (professorData.teaching as any).courseId ?? (professorData.teaching as any).course?.id ?? (professorData.teaching as any).selectedCourse;
                        const vGrade: any = (professorData.teaching as any).gradeIds ?? (professorData.teaching as any).selectedClasses ?? (professorData.teaching as any).gradeIds;
                        const courseMissing = vCourse == null || String(vCourse).trim() === '' || !Number.isFinite(Number(vCourse)) || Number(vCourse) <= 0;
                        const gradeEmpty = vGrade == null || (typeof vGrade === 'string' && vGrade.trim() === '') || (Array.isArray(vGrade) && vGrade.length === 0);
                        if (courseMissing && gradeEmpty) {
                            throw new Error("Enseignement secondaire incomplet : courseId et gradeIds manquants. Veuillez fournir au moins une matière ou une classe.");
                        }
                    }

                    const teachingAssignment = this.teachingAssignmentRepository.create({
                        professor: savedProfessor,
                        schoolType: professorData.teaching.schoolType,
                        teachingType: professorData.teaching.schoolType === 'PRIMARY' 
                            ? TEACHING_TYPE.CLASS_TEACHER 
                            : TEACHING_TYPE.SUBJECT_TEACHER
                    });

                    // Handle PRIMARY teaching type - robust fallback with Number.isFinite guards
                    const createRawClassId: any = (professorData.teaching as any).classId ?? (professorData.teaching as any).class?.id ?? (professorData.teaching as any).selectedClasses?.[0];
                    if (professorData.teaching.schoolType === 'PRIMARY' && createRawClassId != null && String(createRawClassId).trim() !== '') {
                        const cid = Number(createRawClassId);
                        if (!Number.isFinite(cid) || cid <= 0) {
                            logger.warn('createProfessor: invalid classId skipped', createRawClassId);
                        } else {
                            const grade = await transactionalEntityManager.findOne(GradeEntity, {
                                where: { id: cid }
                            });
                            if (grade) {
                                teachingAssignment.class = grade;
                                await transactionalEntityManager.save(teachingAssignment);
                            }
                        }
                    }
                    // Handle SECONDARY teaching type - robust fallback with empty checks
                    else if (professorData.teaching.schoolType === 'SECONDARY') {
                        const createRawCourseId: any = (professorData.teaching as any).courseId ?? (professorData.teaching as any).course?.id ?? (professorData.teaching as any).selectedCourse;
                        if (createRawCourseId != null && String(createRawCourseId).trim() !== '') {
                            const courseId = Number(createRawCourseId);
                            if (!Number.isFinite(courseId) || courseId <= 0) {
                                logger.warn('createProfessor: invalid courseId skipped', createRawCourseId);
                            } else {
                                const course = await transactionalEntityManager.findOne(CourseEntity, {
                                    where: { id: courseId }
                                });
                                if (course) {
                                    teachingAssignment.course = course;
                                }
                            }
                        }

                        const createRawGradeIds: any = (professorData.teaching as any).gradeIds ?? (professorData.teaching as any).selectedClasses;
                        let gradeIdsArray: number[] = [];
                        // Skip empty array or empty string explicitly
                        if (Array.isArray(createRawGradeIds) && createRawGradeIds.length === 0) {
                            gradeIdsArray = [];
                        } else if (typeof createRawGradeIds === 'string' && createRawGradeIds.trim() === '') {
                            gradeIdsArray = [];
                        } else if (typeof createRawGradeIds === 'string') {
                            gradeIdsArray = createRawGradeIds.split(',')
                                .map((id: string) => Number(id.trim()))
                                .filter((id: number) => Number.isFinite(id) && id > 0);
                        } else if (Array.isArray(createRawGradeIds)) {
                            gradeIdsArray = createRawGradeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0);
                        } else if (typeof professorData.teaching.gradeIds === 'string') {
                            if (professorData.teaching.gradeIds.trim() === '') {
                                gradeIdsArray = [];
                            } else {
                                gradeIdsArray = professorData.teaching.gradeIds.split(',')
                                    .map(id => Number(id.trim()))
                                    .filter(id => Number.isFinite(id) && id > 0);
                            }
                        } else if (Array.isArray(professorData.teaching.gradeIds)) {
                            if (professorData.teaching.gradeIds.length === 0) {
                                gradeIdsArray = [];
                            } else {
                                gradeIdsArray = professorData.teaching.gradeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0);
                            }
                        }

                        if (gradeIdsArray.length > 0) {
                            const grades = await transactionalEntityManager.find(GradeEntity, {
                                where: { id: In(gradeIdsArray) }
                            });
                            
                            if (grades.length > 0) {
                                teachingAssignment.class = grades[0];
                                teachingAssignment.grades = grades;
                                teachingAssignment.gradeIds = gradeIdsArray.join(',');
                                teachingAssignment.gradeNames = grades.map(g => g.name).join(', ');
                            }
                        }

                        if (teachingAssignment.course || teachingAssignment.grades || teachingAssignment.class) {
                            await transactionalEntityManager.save(teachingAssignment);
                        }
                    }
                }

                // Fetch the professor with all relations
                const finalProfessor = await transactionalEntityManager.findOne(ProfessorEntity, {
                    where: { id: savedProfessor.id },
                    relations: [
                        'photo',
                        'documents',
                        'teaching',
                        'teaching.class',
                        'teaching.course',
                        'teaching.grades',
                        'diploma',
                        'qualification'
                    ]
                });

                return finalProfessor;
            });

            // Update dashboard stats
            await this.dashboardService.getStats();

            return {
                success: true,
                data: result ? this.mapToProfessorDetails(result) : null,
                message: "Professeur créé avec succès",
                error: null
            };

        } catch (error) {
            logger.error("Erreur dans createProfessor:", error);
            const msg = error instanceof Error ? error.message : "Erreur inconnue";
            if (msg.includes("Enseignement secondaire incomplet")) {
                return {
                    success: false,
                    data: null,
                    message: msg,
                    error: "VALIDATION_ERROR"
                };
            }
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du professeur",
                error: msg
            };
        }
    }

    async updateProfessor(id: number, professorData: IProfessorServiceParams['updateProfessor']['data']): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const dataSource = AppDataSource.getInstance();

            return await dataSource.manager.transaction(async transactionalEntityManager => {
                // Récupérer le professeur existant avec toutes ses relations
                const existingProfessor = await transactionalEntityManager.findOne(ProfessorEntity, {
                    where: { id },
                    relations: ['photo', 'documents', 'teaching', 'teaching.class', 'teaching.course', 'teaching.grades', 'diploma', 'qualification']
                });

                if (!existingProfessor) {
                    return {
                        success: false,
                        data: null,
                        message: "Professeur non trouvé",
                        error: "NOT_FOUND"
                    };
                }

                // Mettre à jour les propriétés de base
                Object.assign(existingProfessor, {
                    firstname: professorData.firstname,
                    lastname: professorData.lastname,
                    civility: professorData.civility,
                    nbr_child: professorData.nbr_child,
                    family_situation: professorData.family_situation,
                    birth_date: professorData.birth_date,
                    birth_town: professorData.birth_town,
                    address: professorData.address,
                    town: professorData.town,
                    cni_number: professorData.cni_number
                });
                if (professorData.color) existingProfessor.color = professorData.color;

                // Handle diploma
                let diploma;
                if (professorData.diploma && professorData.diploma.name) {
                    diploma = await transactionalEntityManager.findOne(DiplomaEntity, {
                        where: { name: professorData.diploma.name }
                    });
                    if (!diploma) {
                        diploma = this.diplomaRepository.create({ name: professorData.diploma.name });
                        diploma = await transactionalEntityManager.save(diploma);
                    }
                }
                existingProfessor.diploma = diploma || undefined;

                // Handle qualification
                let qualification;
                if (professorData.qualification && professorData.qualification.name) {
                    qualification = await transactionalEntityManager.findOne(QualificationEntity, {
                        where: { name: professorData.qualification.name }
                    });
                    if (!qualification) {
                        qualification = this.qualificationRepository.create({ name: professorData.qualification.name });
                        qualification = await transactionalEntityManager.save(qualification);
                    }
                }
                existingProfessor.qualification = qualification || undefined;

                // Handle documents upload
                if (professorData.documents && professorData.documents.length > 0) {
                    const validDocuments = professorData.documents.filter(doc => doc.content);
                    if (validDocuments.length > 0) {
                        const savedDocuments = await Promise.all(
                            validDocuments.map(doc => 
                                this.fileService.saveFile({
                                    content: doc.content!,
                                    name: doc.name,
                                    type: doc.type
                                })
                            )
                        );
                        existingProfessor.documents = savedDocuments;
                    }
                }

                // Save the updated professor
                const savedProfessor = await transactionalEntityManager.save(existingProfessor);

                // Handle teaching assignments if provided
                if (professorData.teaching) {
                    logger.debug("updateProfessor affectation", { schoolType: professorData.teaching?.schoolType });

                    // P1 validation: SECONDARY requires at least courseId or gradeIds
                    if (professorData.teaching.schoolType === 'SECONDARY') {
                        const vCourse: any = (professorData.teaching as any).courseId ?? (professorData.teaching as any).course?.id ?? (professorData.teaching as any).selectedCourse;
                        const vGrade: any = (professorData.teaching as any).gradeIds ?? (professorData.teaching as any).selectedClasses ?? (professorData.teaching as any).gradeIds;
                        const courseMissing = vCourse == null || String(vCourse).trim() === '' || !Number.isFinite(Number(vCourse)) || Number(vCourse) <= 0;
                        const gradeEmpty = vGrade == null || (typeof vGrade === 'string' && vGrade.trim() === '') || (Array.isArray(vGrade) && vGrade.length === 0);
                        if (courseMissing && gradeEmpty) {
                            return {
                                success: false,
                                data: null,
                                message: "Enseignement secondaire incomplet : courseId et gradeIds manquants. Veuillez fournir au moins une matière ou une classe.",
                                error: "VALIDATION_ERROR"
                            };
                        }
                    }
                    
                    // Delete existing teaching assignments
                    await transactionalEntityManager
                        .createQueryBuilder()
                        .delete()
                        .from(TeachingAssignmentEntity)
                        .where("professorId = :id", { id: existingProfessor.id })
                        .execute();

                    const teachingType = professorData.teaching.schoolType === 'PRIMARY' 
                        ? TEACHING_TYPE.CLASS_TEACHER 
                        : TEACHING_TYPE.SUBJECT_TEACHER;

                    const teachingAssignment = this.teachingAssignmentRepository.create({
                        professor: existingProfessor,
                        schoolType: professorData.teaching.schoolType,
                        teachingType: teachingType
                    });

                    // Robust fallback: accepte classId OU class.id OU selectedClasses[0], courseId OU course.id OU selectedCourse - with Number.isFinite guards
                    const rawClassId: any = (professorData.teaching as any).classId ?? (professorData.teaching as any).class?.id ?? (professorData.teaching as any).selectedClasses?.[0];
                    const rawCourseId: any = (professorData.teaching as any).courseId ?? (professorData.teaching as any).course?.id ?? (professorData.teaching as any).selectedCourse;
                    const rawGradeIds: any = (professorData.teaching as any).gradeIds ?? (professorData.teaching as any).selectedClasses;

                    if (professorData.teaching.schoolType === 'PRIMARY' && rawClassId != null && String(rawClassId).trim() !== '') {
                        const cid = Number(rawClassId);
                        if (!Number.isFinite(cid) || cid <= 0) {
                            logger.warn('updateProfessor: invalid classId skipped', rawClassId);
                        } else {
                            const grade = await transactionalEntityManager.findOne(GradeEntity, {
                                where: { id: cid }
                            });
                            if (grade) {
                                teachingAssignment.class = grade;
                                await transactionalEntityManager.save(teachingAssignment);
                            }
                        }
                    } else if (professorData.teaching.schoolType === 'SECONDARY') {
                        if (rawCourseId != null && String(rawCourseId).trim() !== '') {
                            const courseId = Number(rawCourseId);
                            if (!Number.isFinite(courseId) || courseId <= 0) {
                                logger.warn('updateProfessor: invalid courseId skipped', rawCourseId);
                            } else {
                                const course = await transactionalEntityManager.findOne(CourseEntity, {
                                    where: { id: courseId }
                                });
                                if (course) {
                                    teachingAssignment.course = course;
                                }
                            }
                        }

                        let gradeIdsArray: number[] = [];
                        if (Array.isArray(rawGradeIds) && rawGradeIds.length === 0) {
                            gradeIdsArray = [];
                        } else if (typeof rawGradeIds === 'string' && rawGradeIds.trim() === '') {
                            gradeIdsArray = [];
                        } else if (typeof rawGradeIds === 'string') {
                            gradeIdsArray = rawGradeIds.split(',')
                                .map((id: string) => Number(id.trim()))
                                .filter((id: number) => Number.isFinite(id) && id > 0);
                        } else if (Array.isArray(rawGradeIds)) {
                            gradeIdsArray = rawGradeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0);
                        } else if (typeof professorData.teaching.gradeIds === 'string') {
                            if (professorData.teaching.gradeIds.trim() === '') {
                                gradeIdsArray = [];
                            } else {
                                gradeIdsArray = professorData.teaching.gradeIds.split(',')
                                    .map(id => Number(id.trim()))
                                    .filter(id => Number.isFinite(id) && id > 0);
                            }
                        } else if (Array.isArray(professorData.teaching.gradeIds)) {
                            if (professorData.teaching.gradeIds.length === 0) {
                                gradeIdsArray = [];
                            } else {
                                gradeIdsArray = professorData.teaching.gradeIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0);
                            }
                        }

                        if (gradeIdsArray.length > 0) {
                            const grades = await transactionalEntityManager.find(GradeEntity, {
                                where: { id: In(gradeIdsArray) }
                            });
                            
                            if (grades.length > 0) {
                                teachingAssignment.class = grades[0];
                                teachingAssignment.grades = grades;
                                teachingAssignment.gradeIds = gradeIdsArray.join(',');
                                teachingAssignment.gradeNames = grades.map(g => g.name).join(', ');
                            }
                        }

                        if (teachingAssignment.course || teachingAssignment.grades || teachingAssignment.class) {
                            await transactionalEntityManager.save(teachingAssignment);
                        }
                    }
                }

                // Fetch the professor with all updated relations
                const finalProfessor = await transactionalEntityManager.findOne(ProfessorEntity, {
                    where: { id: savedProfessor.id },
                    relations: [
                        'photo',
                        'documents',
                        'teaching',
                        'teaching.class',
                        'teaching.course',
                        'teaching.grades',
                        'diploma',
                        'qualification'
                    ]
                });

                if (!finalProfessor) {
                    throw new Error("Impossible de récupérer le professeur mis à jour");
                }

                return {
                    success: true,
                    data: this.mapToProfessorDetails(finalProfessor),
                    message: "Professeur mis à jour avec succès",
                    error: null
                };
            });
        } catch (error) {
            logger.error("Erreur lors de la mise à jour du professeur:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du professeur",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async deleteProfessor(id: number): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
    
            const professor = await this.professorRepository.findOne({ where: { id } });
    
            if (!professor) {
                return {
                    success: false,
                    data: null,
                    message: "Professeur introuvable",
                    error: "NOT_FOUND"
                };
            }
    
            await this.professorRepository.remove(professor); // Suppression en cascade via les entités
    
            await this.dashboardService.getStats();
    
            return {
                success: true,
                data: null,
                message: "Professeur supprimé avec succès",
                error: null
            };
        } catch (error) {
            logger.error("Erreur lors de la suppression du professeur:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression du professeur",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
    

    async getAllProfessors(): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professors = await this.professorRepository
                .createQueryBuilder("professor")
                .leftJoinAndSelect("professor.photo", "photo")
                .leftJoinAndSelect("professor.documents", "documents")
                .leftJoinAndSelect("professor.diploma", "diploma")
                .leftJoinAndSelect("professor.qualification", "qualification")
                .leftJoinAndSelect("professor.teaching", "teaching")
                .leftJoinAndSelect("teaching.class", "class")
                .leftJoinAndSelect("teaching.course", "course")
                .leftJoinAndSelect("teaching.grades", "grades")
                .getMany();
            
            const mappedProfessors = professors.map(professor => this.mapToProfessorDetails(professor));
            
            return {
                success: true,
                data: mappedProfessors,
                message: 'Professeurs récupérés avec succès',
                error: null
            };
        } catch (error) {
            logger.error('Erreur dans getAllProfessors:', error);
            return {
                success: false,
                data: null,
                message: 'Erreur lors de la récupération des professeurs',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            };
        }
    }

    async getProfessorById(id: number): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professor = await this.professorRepository.findOne({
                where: { id },
                relations: [
                    'diploma',
                    'qualification',
                    'documents',
                    'photo',
                    'teaching',
                    'teaching.class',
                    'teaching.course',
                    'teaching.grades'
                ]
            });

            if (!professor) {
                throw new Error('Professeur non trouvé');
            }

            // If teaching assignments exist, process gradeIds for secondary teachers with Number.isFinite guards
            if (professor.teaching?.length) {
                for (const teaching of professor.teaching) {
                    if (teaching.gradeIds && typeof teaching.gradeIds === 'string' && teaching.gradeIds.trim() !== '') {
                        try {
                            const gradeIdArray = teaching.gradeIds.split(',').map(id => Number(id.trim())).filter(id => Number.isFinite(id) && id > 0);
                            if (gradeIdArray.length === 0) continue;
                            const grades = await this.gradeRepository.find({
                                where: { id: In(gradeIdArray) }
                            });
                            teaching.gradeNames = grades.map(g => g.name).join(', ');
                        } catch (error) {
                            logger.error('Erreur lors du traitement des gradeIds:', error);
                            teaching.gradeNames = '';
                        }
                    }
                }
            }

            return {
                success: true,
                data: professor ? this.mapToProfessorDetails(professor) : null,
                message: "Professeur récupéré avec succès",
                error: null
            };
        } catch (error) {
            logger.error('Erreur lors de la récupération du professeur:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du professeur",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async assignTeaching(professorId: number, assignment: {
        teachingType: TEACHING_TYPE;
        classId?: number;
        courseId?: number;
        gradeIds?: number[];
    }): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professor = await this.professorRepository.findOne({
                where: { id: professorId }
            });

            if (!professor) {
                return {
                    success: false,
                    message: "Professeur non trouvé",
                    error: "NOT_FOUND",
                    data: null
                };
            }

            const teachingAssignment = new TeachingAssignmentEntity();
            teachingAssignment.professor = professor;
            teachingAssignment.teachingType = assignment.teachingType;

            if (assignment.teachingType === TEACHING_TYPE.CLASS_TEACHER) {
                if (!assignment.classId) {
                    throw new Error("ClassId requis pour un instituteur");
                }
                const gradeRepo = this.gradeRepository;
                const grade = await gradeRepo.findOne({
                    where: { id: assignment.classId }
                });
                if (!grade) {
                    throw new Error("Classe non trouvée");
                }
                teachingAssignment.class = grade;
            } else {
                if (!assignment.courseId || !assignment.gradeIds) {
                    throw new Error("CourseId et gradeIds requis pour un professeur de matière");
                }
                const courseRepo = this.courseRepository;
                const course = await courseRepo.findOne({
                    where: { id: assignment.courseId }
                });
                if (!course) {
                    throw new Error("Matière non trouvée");
                }
                teachingAssignment.course = course;
                teachingAssignment.gradeIds = assignment.gradeIds.join(',');
            }

            await this.teachingAssignmentRepository.save(teachingAssignment);

            const updatedProfessor = await this.professorRepository.findOne({
                where: { id: professorId },
                relations: ['teaching', 'teaching.class', 'teaching.course', 'photo', 'documents', 'diploma', 'qualification']
            });

            return {
                success: true,
                message: "Affectation créée avec succès",
                error: null,
                data: updatedProfessor ? this.mapToProfessorDetails(updatedProfessor) : null
            };
        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de l'affectation",
                error: error instanceof Error ? error.message : "Unknown error",
                data: null
            };
        }
    }

    async getTeachingAssignments(professorId: number): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professor = await this.professorRepository.findOne({
                where: { id: professorId },
                relations: ['teaching', 'teaching.class', 'teaching.course']
            });

            if (!professor) {
                return {
                    success: false,
                    message: "Professeur non trouvé",
                    error: "NOT_FOUND",
                    data: null
                };
            }

            return {
                success: true,
                message: "Affectations récupérées avec succès",
                error: null,
                data: this.mapToProfessorDetails(professor)
            };
        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de la récupération des affectations",
                error: error instanceof Error ? error.message : "Unknown error",
                data: null
            };
        }
    }

    async getTotalProfessors(): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const count = await this.professorRepository
                .createQueryBuilder('professor')
                .getCount();

            logger.debug('Nombre total de professeurs:', count);

            // Créer un objet IProfessorDetails avec les champs requis
            const professorStats: IProfessorDetails = {
                id: 0,
                firstname: 'TOTAL',
                lastname: '',
                civility: '',
                family_situation: '',
                birth_town: '',
                address: '',
                town: '',
                cni_number: '',
                color: '#409EFF',
                nbr_child: count,
                teaching: []
            };

            return {
                success: true,
                data: professorStats,
                message: "Nombre total de professeurs récupéré avec succès",
                error: null
            };
        } catch (error) {
            logger.error('Erreur lors du comptage des professeurs:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du comptage des professeurs",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async searchProfessors(query: string): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professors = await this.professorRepository
                .createQueryBuilder('professor')
                .where('professor.firstname LIKE :query OR professor.lastname LIKE :query', {
                    query: `%${query}%`
                })
                .getMany();

            return {
                success: true,
                data: professors.map(p => this.mapToProfessorDetails(p)),
                message: "Professeurs trouvés avec succès",
                error: null
            };
        } catch (error) {
            logger.error('Erreur lors de la recherche des professeurs:', error);
            return {
                success: false,
                data: [],
                message: "Erreur lors de la recherche des professeurs",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Récupérer le professeur enseignant un cours dans une classe spécifique
     */
    async getProfessorByCourseAndGrade(courseId: number, gradeId: number): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            logger.debug(`🔍 Recherche professeur pour courseId=${courseId}, gradeId=${gradeId}`);
            
            // ÉTAPE 1 : Chercher un professeur de matière (SECONDARY) affecté spécifiquement à ce cours
            const secondaryTeachingAssignments = await this.teachingAssignmentRepository
                .createQueryBuilder('teaching')
                .leftJoinAndSelect('teaching.professor', 'professor')
                .leftJoinAndSelect('teaching.course', 'course')
                .leftJoinAndSelect('teaching.class', 'class')
                .leftJoinAndSelect('teaching.grades', 'grades')
                .where('teaching.course.id = :courseId', { courseId })
                .andWhere('teaching.teachingType = :type', { type: TEACHING_TYPE.SUBJECT_TEACHER })
                .getMany();

            logger.debug(`📚 Affectations SECONDARY trouvées: ${secondaryTeachingAssignments.length}`);

            // Filtrer pour trouver celle qui correspond à la classe - with Number.isFinite guards
            let teachingAssignment = secondaryTeachingAssignments.find(ta => {
                // Vérifier si la classe unique correspond
                if (ta.class && Number.isFinite(Number(ta.class.id)) && Number(ta.class.id) === gradeId) {
                    return true;
                }
                // Vérifier si la classe est dans gradeIds (string CSV or array)
                if (ta.gradeIds != null && String(ta.gradeIds).trim() !== '') {
                    const raw: any = (ta as any).gradeIds;
                    const gradeIdArray = Array.isArray(raw)
                        ? raw.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
                        : String(raw).split(',').map(id => Number(id.trim())).filter((n: number) => Number.isFinite(n) && n > 0);
                    if (gradeIdArray.includes(gradeId)) {
                        return true;
                    }
                }
                // Vérifier si la classe est dans grades (relation ManyToMany)
                if (ta.grades && ta.grades.length > 0) {
                    if (ta.grades.some(g => Number.isFinite(Number(g.id)) && Number(g.id) === gradeId)) {
                        return true;
                    }
                }
                return false;
            });

            // ÉTAPE 2 : Si aucun professeur de matière n'est trouvé, chercher le professeur titulaire (CLASS_TEACHER)
            if (!teachingAssignment) {
                logger.debug('🔄 Aucun prof SECONDARY, recherche du professeur titulaire (CLASS_TEACHER)...');
                
                const classTacherAssignments = await this.teachingAssignmentRepository
                    .createQueryBuilder('teaching')
                    .leftJoinAndSelect('teaching.professor', 'professor')
                    .leftJoinAndSelect('teaching.class', 'class')
                    .where('teaching.class.id = :gradeId', { gradeId })
                    .andWhere('teaching.teachingType = :type', { type: TEACHING_TYPE.CLASS_TEACHER })
                    .getMany();

                logger.debug(`👨‍🏫 Professeurs titulaires trouvés: ${classTacherAssignments.length}`);
                
                if (classTacherAssignments.length > 0) {
                    teachingAssignment = classTacherAssignments[0];
                    logger.debug(`✅ Professeur titulaire utilisé: ${teachingAssignment.professor?.firstname} ${teachingAssignment.professor?.lastname}`);
                }
            } else {
                logger.debug(`✅ Professeur de matière trouvé: ${teachingAssignment.professor?.firstname} ${teachingAssignment.professor?.lastname}`);
            }

            if (!teachingAssignment || !teachingAssignment.professor) {
                logger.debug('❌ Aucun professeur trouvé (ni SECONDARY, ni CLASS_TEACHER)');
                return {
                    success: false,
                    message: "Aucun professeur trouvé pour ce cours dans cette classe",
                    error: "NOT_FOUND",
                    data: null
                };
            }

            // Retourner les informations du professeur
            return {
                success: true,
                message: "Professeur trouvé avec succès",
                error: null,
                data: {
                    id: teachingAssignment.professor.id,
                    firstname: teachingAssignment.professor.firstname,
                    lastname: teachingAssignment.professor.lastname,
                    civility: teachingAssignment.professor.civility,
                    family_situation: teachingAssignment.professor.family_situation,
                    birth_town: teachingAssignment.professor.birth_town,
                    address: teachingAssignment.professor.address,
                    town: teachingAssignment.professor.town,
                    cni_number: teachingAssignment.professor.cni_number,
                    color: (teachingAssignment.professor as any).color || '#409EFF',
                    nbr_child: teachingAssignment.professor.nbr_child,
                    teaching: []
                }
            };
        } catch (error) {
            logger.error('Erreur lors de la récupération du professeur:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du professeur",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
}

   