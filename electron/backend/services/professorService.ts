import { AppDataSource } from "#electron/data-source";
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
        
        console.log("Teaching data in entity:", professor.teaching);
        
        if (professor.teaching && Array.isArray(professor.teaching) && professor.teaching.length > 0) {
            mappedProfessor.teaching = professor.teaching.map(teaching => {
                const mappedTeaching: ITeachingAssignment = {
                    id: teaching.id,
                    schoolType: teaching.schoolType === 'PRIMARY' ? 'PRIMARY' : 'SECONDARY'
                };
                
                if (teaching.class) {
                    mappedTeaching.class = {
                        id: Number(teaching.class.id),
                        name: String(teaching.class.name)
                    };
                }
                
                if (teaching.course) {
                    mappedTeaching.course = {
                        id: Number(teaching.course.id),
                        name: String(teaching.course.name)
                    };
                }
                
                // S'assurer que les grades sont correctement mappés
                if (teaching.grades && Array.isArray(teaching.grades) && teaching.grades.length > 0) {
                    mappedTeaching.grades = teaching.grades.map(grade => ({
                        id: Number(grade.id),
                        name: String(grade.name)
                    }));
                    
                    // Si c'est un enseignement secondaire, on définit aussi la classe principale
                    if (teaching.schoolType === 'SECONDARY' && teaching.grades.length > 0) {
                        mappedTeaching.class = {
                            id: Number(teaching.grades[0].id),
                            name: String(teaching.grades[0].name)
                        };
                    }
                }
                
                return mappedTeaching;
            });
            
            console.log("Mapped teaching data:", mappedProfessor.teaching);
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
                await AppDataSource.initialize();
            }
            
            this.professorRepository = dataSource.getRepository(ProfessorEntity);
            this.diplomaRepository = dataSource.getRepository(DiplomaEntity);
            this.qualificationRepository = dataSource.getRepository(QualificationEntity);
            this.teachingAssignmentRepository = dataSource.getRepository(TeachingAssignmentEntity);
            this.gradeRepository = dataSource.getRepository(GradeEntity);
            this.courseRepository = dataSource.getRepository(CourseEntity);
        } catch (error) {
            console.error("Error initializing repositories:", error);
            throw error;
        }
    }

    async createProfessor(professorData: IProfessorServiceParams['createProfessor']): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const dataSource = AppDataSource.getInstance();

            // Récupérer les informations de l'école pour le matricule
            const schoolInfo = await this.schoolService.getSchool();
            const schoolName = schoolInfo.data?.name || undefined;

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
                    qualification: qualification || undefined
                });

                // Générer le matricule personnalisé
                professor.matricule = ProfessorEntity.generateMatricule(schoolName);

                // Handle photo upload
                if (professorData.photo && professorData.photo.content) {
                    const savedPhoto = await this.fileService.saveFile({
                        content: professorData.photo.content,
                        name: professorData.photo.name,
                        type: professorData.photo.type
                    });
                    professor.photo = savedPhoto;
                }

                const savedProfessor = await transactionalEntityManager.save(professor);

                // Handle documents upload
                if (professorData.documents && professorData.documents.length > 0) {
                    const validDocuments = professorData.documents.filter(doc => doc.content);
                    const savedDocuments = await Promise.all(
                        validDocuments.map(doc => 
                            this.fileService.saveFile({
                                content: doc.content!,
                                name: doc.name,
                                type: doc.type
                            })
                        )
                    );
                    savedProfessor.documents = [...(savedProfessor.documents || []), ...savedDocuments];
                    await transactionalEntityManager.save(savedProfessor);
                }

                // Handle teaching assignments
                if (professorData.teaching) {
                    console.log('Création de l\'affectation d\'enseignement:', professorData.teaching);

                    const teachingAssignment = this.teachingAssignmentRepository.create({
                        professor: savedProfessor,
                        schoolType: professorData.teaching.schoolType,
                        teachingType: professorData.teaching.schoolType === 'PRIMARY' 
                            ? TEACHING_TYPE.CLASS_TEACHER 
                            : TEACHING_TYPE.SUBJECT_TEACHER
                    });

                    // Handle PRIMARY teaching type
                    if (professorData.teaching.schoolType === 'PRIMARY' && professorData.teaching.classId) {
                        const grade = await transactionalEntityManager.findOne(GradeEntity, {
                            where: { id: professorData.teaching.classId }
                        });
                        teachingAssignment.class = grade || undefined;
                    }

                    // Handle SECONDARY teaching type
                    else if (professorData.teaching.schoolType === 'SECONDARY') {
                        if (professorData.teaching.courseId) {
                            const course = await transactionalEntityManager.findOne(CourseEntity, {
                                where: { id: professorData.teaching.courseId }
                            });
                            teachingAssignment.course = course || undefined;
                        }

                        // Traiter les gradeIds
                        let gradeIdsArray: number[] = [];
                        if (typeof professorData.teaching.gradeIds === 'string') {
                            gradeIdsArray = professorData.teaching.gradeIds.split(',')
                                .map(id => parseInt(id.trim()))
                                .filter(id => !isNaN(id));
                        } else if (Array.isArray(professorData.teaching.gradeIds)) {
                            gradeIdsArray = professorData.teaching.gradeIds;
                        }

                        if (gradeIdsArray.length > 0) {
                            const grades = await this.gradeRepository.find({
                                where: { id: In(gradeIdsArray) }
                            });
                            
                            // Sauvegarder d'abord l'affectation d'enseignement de base
                            const savedTeaching = await this.teachingAssignmentRepository.save({
                                ...teachingAssignment,
                                class: grades[0], // Utiliser le premier grade comme classe principale
                                grades: grades,
                                gradeIds: gradeIdsArray.join(','),
                                gradeNames: grades.map(g => g.name).join(', ')
                            });

                            console.log("Affectation sauvegardée avec grades:", savedTeaching);
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
            console.error("Erreur dans createProfessor:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du professeur",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async updateProfessor(id: number, professorData: IProfessorServiceParams['updateProfessor']['data']): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();

            // Récupérer le professeur existant avec toutes ses relations
            const existingProfessor = await this.professorRepository.findOne({
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

            console.log("updateProfessor: Données existantes du professeur: ID=" + existingProfessor.id + ", Nom=" + existingProfessor.firstname + " " + existingProfessor.lastname);
            console.log("updateProfessor: Affectations existantes: Nombre=" + (existingProfessor.teaching?.length || 0));

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

            // Save the updated professor first
            const savedProfessor = await this.professorRepository.save(existingProfessor);

            // Handle teaching assignments if provided
            if (professorData.teaching) {
                console.log("updateProfessor: Données d'affectation reçues:", JSON.stringify(professorData.teaching, null, 2));
                
                // Delete existing teaching assignments
                await this.teachingAssignmentRepository
                    .createQueryBuilder()
                    .delete()
                    .from(TeachingAssignmentEntity)
                    .where("professorId = :id", { id: existingProfessor.id })
                    .execute();

                const teachingType = professorData.teaching.schoolType === 'PRIMARY' 
                    ? TEACHING_TYPE.CLASS_TEACHER 
                    : TEACHING_TYPE.SUBJECT_TEACHER;

                let teachingData = new TeachingAssignmentEntity();
                teachingData.professor = existingProfessor;
                teachingData.schoolType = professorData.teaching.schoolType;
                teachingData.teachingType = teachingType;

                if (professorData.teaching.schoolType === 'PRIMARY' && professorData.teaching.classId) {
                    const grade = await this.gradeRepository.findOne({
                        where: { id: professorData.teaching.classId }
                    });
                    if (grade) {
                        teachingData.class = grade;
                    }
                } else if (professorData.teaching.schoolType === 'SECONDARY') {
                    if (professorData.teaching.courseId) {
                        const course = await this.courseRepository.findOne({
                            where: { id: professorData.teaching.courseId }
                        });
                        if (course) {
                            teachingData.course = course;
                        }
                    }

                    let gradeIdsArray: number[] = [];
                    if (typeof professorData.teaching.gradeIds === 'string') {
                        gradeIdsArray = professorData.teaching.gradeIds.split(',')
                            .map(id => parseInt(id.trim()))
                            .filter(id => !isNaN(id));
                    } else if (Array.isArray(professorData.teaching.gradeIds)) {
                        gradeIdsArray = professorData.teaching.gradeIds;
                    }

                    if (gradeIdsArray.length > 0) {
                        const grades = await this.gradeRepository.find({
                            where: { id: In(gradeIdsArray) }
                        });
                        
                        // Sauvegarder d'abord l'affectation d'enseignement de base
                        const savedTeaching = await this.teachingAssignmentRepository.save({
                            ...teachingData,
                            class: grades[0], // Utiliser le premier grade comme classe principale
                            grades: grades,
                            gradeIds: gradeIdsArray.join(','),
                            gradeNames: grades.map(g => g.name).join(', ')
                        });

                        console.log("Affectation sauvegardée avec grades:", savedTeaching);
                    }
                }
            }

            // Fetch the professor with all updated relations
            console.log("updateProfessor: Récupération du professeur mis à jour avec toutes les relations");

            const finalProfessor = await this.professorRepository
                .createQueryBuilder("professor")
                .leftJoinAndSelect("professor.photo", "photo")
                .leftJoinAndSelect("professor.documents", "documents")
                .leftJoinAndSelect("professor.teaching", "teaching")
                .leftJoinAndSelect("teaching.class", "class")
                .leftJoinAndSelect("teaching.course", "course")
                .leftJoinAndSelect("teaching.grades", "grades")
                .leftJoinAndSelect("professor.diploma", "diploma")
                .leftJoinAndSelect("professor.qualification", "qualification")
                .where("professor.id = :id", { id: savedProfessor.id })
                .getOne();

            if (!finalProfessor) {
                throw new Error("Impossible de récupérer le professeur mis à jour");
            }

            // Log des données pour le débogage
            console.log("Teaching data in entity:", finalProfessor.teaching);

            return {
                success: true,
                data: this.mapToProfessorDetails(finalProfessor),
                message: "Professeur mis à jour avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la mise à jour du professeur:", error);
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

            const professor = await this.professorRepository.findOne({
                where: { id },
                relations: ['diploma', 'qualification', 'user']
            });

            if (!professor) {
                return {
                    success: false,
                    data: null,
                    message: "Professeur non trouvé",
                    error: "NOT_FOUND"
                };
            }

            await this.professorRepository.remove(professor);

            return {
                success: true,
                data: null,
                message: "Professeur supprimé avec succès",
                error: null
            };
        } catch (error) {
            console.error("Error deleting professor:", error);
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
            console.error('Erreur dans getAllProfessors:', error);
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

            // If teaching assignments exist, process gradeIds for secondary teachers
            if (professor.teaching?.length) {
                for (const teaching of professor.teaching) {
                    if (teaching.gradeIds && typeof teaching.gradeIds === 'string') {
                        try {
                            const gradeIdArray = teaching.gradeIds.split(',').map(id => parseInt(id.trim()));
                            const grades = await this.gradeRepository.find({
                                where: { id: In(gradeIdArray) }
                            });
                            teaching.gradeNames = grades.map(g => g.name).join(', ');
                        } catch (error) {
                            console.error('Erreur lors du traitement des gradeIds:', error);
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
            console.error('Erreur lors de la récupération du professeur:', error);
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

            console.log('Nombre total de professeurs:', count);

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
            console.error('Erreur lors du comptage des professeurs:', error);
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
            console.error('Erreur lors de la recherche des professeurs:', error);
            return {
                success: false,
                data: [],
                message: "Erreur lors de la recherche des professeurs",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
}

   