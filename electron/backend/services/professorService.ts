import { AppDataSource } from "#electron/data-source";
import { ProfessorEntity, DiplomaEntity, QualificationEntity } from "#electron/backend/entities/professor";
import { Repository } from "typeorm";
import { TeachingAssignmentEntity } from "../entities/teaching";
import { TEACHING_TYPE } from "#electron/command";
import { GradeEntity } from "../entities/grade";
import { CourseEntity } from "../entities/course";
import { FileService } from "#electron/backend/services/fileService";
import { DashboardService } from "#electron/backend/services/dashboardService";
import {
    IProfessorServiceParams,
    IProfessorServiceResponse,
    IProfessorDetails
} from "../types/professor";

export class ProfessorService {
    private professorRepository!: Repository<ProfessorEntity>;
    private diplomaRepository!: Repository<DiplomaEntity>;
    private qualificationRepository!: Repository<QualificationEntity>;
    private teachingAssignmentRepository!: Repository<TeachingAssignmentEntity>;
    private gradeRepository!: Repository<GradeEntity>;
    private fileService: FileService;
    private dashboardService: DashboardService;

    private mapToProfessorDetails(professor: ProfessorEntity): IProfessorDetails {
        return {
            ...professor,
            photo: professor.photo ? {
                id: professor.photo.id,
                name: professor.photo.name,
                type: professor.photo.type
            } : undefined,
            documents: professor.documents?.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: doc.type
            })) || []
        };
    }

    constructor() {
        this.fileService = new FileService();
        this.dashboardService = new DashboardService();
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
        } catch (error) {
            console.error("Error initializing repositories:", error);
            throw error;
        }
    }

    async createProfessor(professorData: IProfessorServiceParams['createProfessor']): Promise<IProfessorServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const dataSource = AppDataSource.getInstance();

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

                        if (Array.isArray(professorData.teaching.gradeIds) && professorData.teaching.gradeIds.length > 0) {
                            const grades = await transactionalEntityManager.findByIds(GradeEntity, professorData.teaching.gradeIds);
                            teachingAssignment.grades = grades;
                            teachingAssignment.gradeIds = professorData.teaching.gradeIds.join(',');
                            teachingAssignment.gradeNames = grades.map(g => g.name).join(', ');
                        }
                    }

                    await transactionalEntityManager.save(teachingAssignment);
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

            // Retrieve the existing professor with all relations
            const existingProfessor = await this.professorRepository.findOne({
                where: { id },
                relations: [
                    'diploma',
                    'qualification',
                    'documents',
                    'photo',
                    'teaching'
                ]
            });

            if (!existingProfessor) {
                return {
                    success: false,
                    message: "Professeur non trouvé",
                    error: "NOT_FOUND",
                    data: null
                };
            }

            // Update basic information
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

            // Update diploma if provided
            if (professorData.diploma) {
                if (existingProfessor.diploma) {
                    existingProfessor.diploma.name = professorData.diploma.name;
                    await this.diplomaRepository.save(existingProfessor.diploma);
                } else {
                    const diploma = new DiplomaEntity();
                    diploma.name = professorData.diploma.name;
                    existingProfessor.diploma = await this.diplomaRepository.save(diploma);
                }
            }

            // Update qualification if provided
            if (professorData.qualification) {
                if (existingProfessor.qualification) {
                    existingProfessor.qualification.name = professorData.qualification.name;
                    await this.qualificationRepository.save(existingProfessor.qualification);
                } else {
                    const qualification = new QualificationEntity();
                    qualification.name = professorData.qualification.name;
                    existingProfessor.qualification = await this.qualificationRepository.save(qualification);
                }
            }

            // Handle new documents if provided
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
                existingProfessor.documents = [...(existingProfessor.documents || []), ...savedDocuments];
            }

            // Handle photo update if provided
            if (professorData.photo && professorData.photo.content) {
                const savedPhoto = await this.fileService.saveFile({
                    content: professorData.photo.content,
                    name: professorData.photo.name,
                    type: professorData.photo.type
                });
                existingProfessor.photo = savedPhoto;
            }

            // Save the updated professor
            const updatedProfessor = await this.professorRepository.save(existingProfessor);

            return {
                success: true,
                data: this.mapToProfessorDetails(updatedProfessor),
                message: "Professeur mis à jour avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du professeur",
                error: error instanceof Error ? error.message : "Erreur inconnue"
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
            const professors = await this.professorRepository.find({
                relations: [
                    'diploma',
                    'qualification',
                    'teaching',
                    'teaching.class',
                    'teaching.course'
                ],
                order: {
                    lastname: 'ASC'
                }
            });

            return {
                success: true,
                data: professors.map(p => this.mapToProfessorDetails(p)),
                message: "Professeurs récupérés avec succès",
                error: null
            };
        } catch (error) {
            console.error("Error getting professors:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des professeurs",
                error: error instanceof Error ? error.message : "Erreur inconnue"
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
                            const grades = await this.gradeRepository.findByIds(gradeIdArray);
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
            const dataSource = AppDataSource.getInstance();
            
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
                const gradeRepo = dataSource.getRepository(GradeEntity);
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
                const courseRepo = dataSource.getRepository(CourseEntity);
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

            return {
                success: true,
                data: { total: count } as unknown as IProfessorDetails,
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
                data: professors,
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

   