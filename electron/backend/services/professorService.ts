import { AppDataSource } from "#electron/data-source";
import { ProfessorEntity, DiplomaEntity, QualificationEntity } from "#electron/backend/entities/professor";
import { ResultType } from "#electron/command";
import { Repository } from "typeorm";
import { TeachingAssignmentEntity } from "../entities/teaching";
import { TEACHING_TYPE } from "#electron/command";
import { GradeEntity } from "../entities/grade";
import { CourseEntity } from "../entities/course";
import { FileService } from "#electron/backend/services/fileService";
import { SCHOOL_TYPE } from "#electron/command";


export class ProfessorService {
    private professorRepository!: Repository<ProfessorEntity>;
    private diplomaRepository!: Repository<DiplomaEntity>;
    private qualificationRepository!: Repository<QualificationEntity>;
    private teachingAssignmentRepository!: Repository<TeachingAssignmentEntity>;
    private gradeRepository!: Repository<GradeEntity>;
    private courseRepository!: Repository<CourseEntity>;
    private fileService: FileService;

    constructor() {
        this.fileService = new FileService();
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

    async createProfessor(professorData: any): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            // Créer le professeur
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
            });

            // Gérer la photo
            if (professorData.photo) {
                const savedPhoto = await this.fileService.saveFile(
                    professorData.photo.content,
                    professorData.photo.name,
                    professorData.photo.type
                );
                professor.photo = savedPhoto;
            }

            // Sauvegarder les documents
            if (professorData.documents?.length) {
                const savedDocuments = await this.fileService.saveDocuments(
                    professorData.documents,
                    professor.id
                );
                professor.documents = savedDocuments;
            }

            // Sauvegarder le professeur
            const savedProfessor = await this.professorRepository.save(professor);

            // Gérer l'affectation d'enseignement
            if (professorData.teaching) {
                const teaching = new TeachingAssignmentEntity();
                teaching.professor = savedProfessor; // Utilisez l'instance sauvegardée
                teaching.schoolType = professorData.teaching.schoolType;
                teaching.teachingType = professorData.teaching.schoolType === SCHOOL_TYPE.PRIMARY
                    ? TEACHING_TYPE.CLASS_TEACHER
                    : TEACHING_TYPE.SUBJECT_TEACHER;
            
                if (professorData.teaching.schoolType === SCHOOL_TYPE.PRIMARY) {
                    // Pour le primaire, une seule classe
                    if (professorData.teaching.classId) {
                        const grade = await this.gradeRepository.findOne({
                            where: { id: professorData.teaching.classId }
                        });
                        if (grade) {
                            teaching.class = grade;
                        }
                    }
                } else {
                    // Pour le secondaire, matière et plusieurs classes
                    if (professorData.teaching.courseId) {
                        const course = await this.courseRepository.findOne({
                            where: { id: professorData.teaching.courseId }
                        });
                        if (course) {
                            teaching.course = course;
                        }
                    }
            
                    if (professorData.teaching.gradeIds?.length) {
                        teaching.gradeIds = professorData.teaching.gradeIds.join(',');
                    }
                }
            
                await this.teachingAssignmentRepository.save(teaching);
            
            }
            

            return {
                success: true,
                data: savedProfessor,
                message: "Professeur créé avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans createProfessor:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du professeur",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async updateProfessor(id: number, professorData: any): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();

            // Récupérer le professeur existant avec toutes ses relations
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

            // Mettre à jour les informations de base
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

            // Mettre à jour le diplôme
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

            // Mettre à jour la qualification
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

            // Gérer les nouveaux documents
            if (professorData.documents?.length > 0) {
                const savedDocuments = await Promise.all(
                    professorData.documents.map((doc: { content: string; name: string; type: string; }) => 
                        this.fileService.saveFile(doc.content, doc.name, doc.type)
                    )
                );
                existingProfessor.documents = [...(existingProfessor.documents || []), ...savedDocuments];
            }

            // Mettre à jour la photo si nécessaire
            if (professorData.photo) {
                const savedPhoto = await this.fileService.saveFile(
                    professorData.photo.content,
                    professorData.photo.name,
                    professorData.photo.type
                );
                existingProfessor.photo = savedPhoto;
            }

            // Sauvegarder les modifications
            const updatedProfessor = await this.professorRepository.save(existingProfessor);

            return {
                success: true,
                data: updatedProfessor,
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

    async deleteProfessor(id: number): Promise<ResultType> {
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

    async getAllProfessors(): Promise<ResultType> {
        try {
            const professors = await this.professorRepository.find({
                relations: [
                    'diploma',
                    'qualification',
                    'user',
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
                data: professors,
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

    async getProfessorById(id: number): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const professor = await this.professorRepository.findOne({
                where: { id },
                relations: [
                    'diploma',
                    'qualification',
                    'user',
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

            // Si le professeur a des affectations, charger les noms des classes
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
                data: professor,
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
    }): Promise<ResultType> {
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

            return {
                success: true,
                message: "Affectation créée avec succès",
                error: null,
                data: teachingAssignment
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

    async getTeachingAssignments(professorId: number): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const assignments = await this.teachingAssignmentRepository.find({
                where: { professor: { id: professorId } },
                relations: ['class', 'course']
            });

            return {
                success: true,
                message: "Affectations récupérées avec succès",
                error: null,
                data: assignments
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

    async getTotalProfessors(): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const count = await this.professorRepository
                .createQueryBuilder('professor')
                .getCount();

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

    async searchProfessors(query: string): Promise<ResultType> {
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