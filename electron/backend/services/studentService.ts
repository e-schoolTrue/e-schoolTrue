import { Repository } from "typeorm";
import { StudentEntity } from "../entities/students";
import { GradeEntity } from "../entities/grade";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { FileService } from "./fileService";
import { DashboardService } from "./dashboardService";
import { SchoolService } from "./schoolService";
import { CascadeDelete } from "../utils/cascadeDelete";
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
                where: [
                    {
                        firstname: studentData.firstname,
                        lastname: studentData.lastname,
                        birthDay: studentData.birthDay
                    }
                ]
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
    async getAllStudents(): Promise<StudentEntity[]> {
        try {
            return await this.studentRepository.find({
                relations: ["photo", "documents", "grade"],
            });
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
    async updateStudent(id: number, studentData: IStudentServiceParams['updateStudent']['data']): Promise<IStudentServiceResponse> {
        try {
            const existingStudent = await this.studentRepository.findOne({
                where: { id },
                relations: ["photo", "documents"],
            });

            if (!existingStudent) {
                return {
                    success: false,
                    data: null,
                    error: "Étudiant non trouvé",
                    message: "L'étudiant à mettre à jour n'existe pas"
                };
            }

            // Mettre à jour les données de l'étudiant
            Object.assign(existingStudent, studentData);

            // Sauvegarde de la photo si elle existe
            if (studentData.photo?.content) {
                const savedPhoto = await this.fileService.saveFile({
                    content: studentData.photo.content,
                    name: studentData.photo.name,
                    type: studentData.photo.type
                });
                existingStudent.photo = savedPhoto;
            }

            // Sauvegarder les nouveaux documents
            const documents = studentData.documents || [];
            if (documents.length > 0) {
                const newDocuments = await Promise.all(
                    documents.map(doc =>
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
}

