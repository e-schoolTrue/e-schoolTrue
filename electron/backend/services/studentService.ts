import { Repository } from "typeorm";
import { StudentEntity } from "../entities/students";
import { FileEntity } from "../entities/file";
import { GradeEntity } from "../entities/grade";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { FileService } from "./fileService";

// Déplacer l'interface en dehors de la classe
interface StudentDetailsResponse {
  id: number;
  firstname?: string;
  lastname?: string;
  matricule?: string;
  birthDay?: Date;
  birthPlace?: string;
  address?: string;
  fatherFirstname?: string;
  fatherLastname?: string;
  motherFirstname?: string;
  motherLastname?: string;
  famillyPhone?: string;
  personalPhone?: string;
  sex?: "male" | "female";
  schoolYear?: string;
  photo: {
    id: number;
    name: string;
    type: string;
  } | null;
  documents: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  gradeId?: number;
  grade: {
    id: number;
    name?: string;
    description?: string;
    code?: string;
  } | null;
}
export class StudentService {
  private studentRepository: Repository<StudentEntity>;
  private fileRepository: Repository<FileEntity>;
  private gradeRepository: Repository<GradeEntity>;
  private fileService: FileService;

  constructor() {
    const dataSource = AppDataSource.getInstance();
    this.studentRepository = dataSource.getRepository(StudentEntity);
    this.fileRepository = dataSource.getRepository(FileEntity);
    this.gradeRepository = dataSource.getRepository(GradeEntity);
    this.fileService = new FileService();
  }

  async createStudent(studentData: any): Promise<ResultType> {
    try {
        // Vérifier la classe (grade)
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

        // Vérifier les champs obligatoires
        if (
            !studentData.firstname ||
            !studentData.lastname ||
            !studentData.fatherFirstname ||
            !studentData.fatherLastname
        ) {
            return {
                success: false,
                data: null,
                message: "Les informations obligatoires sont manquantes.",
                error: "Champs obligatoires manquants : prénom, nom, prénom du père, nom du père.",
            };
        }

        // Utiliser une transaction pour garantir l'intégrité des données
        const dataSource = AppDataSource.getInstance();
        const result = await dataSource.manager.transaction(async transactionalEntityManager => {
            // Créer l'étudiant
            const student = this.studentRepository.create({
                firstname: studentData.firstname,
                lastname: studentData.lastname,
                matricule: studentData.matricule,
                fatherFirstname: studentData.fatherFirstname || "",
                fatherLastname: studentData.fatherLastname || "",
                motherFirstname: studentData.motherFirstname || "",
                motherLastname: studentData.motherLastname || "",
                birthDay: studentData.birthDay,
                birthPlace: studentData.birthPlace || "",
                address: studentData.address || "",
                famillyPhone: studentData.famillyPhone || "",
                personalPhone: studentData.personalPhone || "",
                sex: studentData.sex || "",
                schoolYear: studentData.schoolYear || "",
                grade: grade || undefined,
            });

            // Gérer la photo de l'étudiant
            if (studentData.photo) {
                const savedPhoto = await this.fileService.saveFile(
                    studentData.photo.content,
                    studentData.photo.name,
                    studentData.photo.type
                );
                student.photo = savedPhoto;
            }

            // Sauvegarder l'étudiant
            const savedStudent = await transactionalEntityManager.save(student);

            // Gérer les documents
            if (studentData.documents?.length > 0) {
                const savedDocuments = await Promise.all(
                    studentData.documents.map((doc: any) =>
                        this.fileService.saveFile(
                            doc.content,
                            doc.name,
                            doc.type
                        )
                    )
                );

                // Associer les documents à l'étudiant
                savedStudent.documents = savedDocuments;
                await transactionalEntityManager.save(savedStudent);
            }

            // Récupérer l'étudiant avec toutes ses relations
            const finalStudent = await transactionalEntityManager.findOne(StudentEntity, {
                where: { id: savedStudent.id },
                relations: ['photo', 'documents', 'grade']
            });

            return finalStudent;
        });

        return {
            success: true,
            data: result,
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



  async getAllStudents(): Promise<StudentEntity[]> {
    try {
      return await this.studentRepository.find({
        relations: ["photo", "documents", "grade"],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Une erreur inconnue est survenue";
      console.error("Erreur détaillée dans getAllStudents:", error);
      throw new Error(
        "Erreur lors de la récupération des étudiants: " + errorMessage
      );
    }
  }
  async getStudentDetails(studentId: number): Promise<ResultType> {
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
  
      const studentDetails: StudentDetailsResponse = {
        id: student.id,
        firstname: student.firstname,
        lastname: student.lastname,
        matricule: student.matricule,
        birthDay: student.birthDay,
        birthPlace: student.birthPlace,
        address: student.address,
        famillyPhone: student.famillyPhone,
        personalPhone: student.personalPhone,
        fatherLastname: student.fatherLastname,
        motherFirstname: student.motherFirstname,
        motherLastname: student.motherLastname,
        sex: student.sex,
        schoolYear: student.schoolYear,
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
        gradeId: student.grade?.id,
        grade: student.grade ? {
          id: student.grade.id ?? 0, // Ajoutez un fallback pour id
          name: student.grade.name ?? undefined,
         
          code: student.grade.code ?? undefined
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
  async updateStudent(
    studentId: number,
    studentData: any
  ): Promise<ResultType> {
    try {
      console.log(
        "1. Données reçues pour mise à jour:",
        JSON.stringify(
          {
            ...studentData,
            documents: studentData.documents
              ? studentData.documents.map((d: any) => ({
                  name: d.name,
                  type: d.type,
                  hasContent: !!d.content?.length,
                }))
              : [],
          },
          null,
          2
        )
      );

      const existingStudent = await this.studentRepository.findOne({
        where: { id: studentId },
        relations: ["photo", "documents"],
      });

      if (!existingStudent) {
        throw new Error("Étudiant non trouvé");
      }

      // Gérer la photo
      if (studentData.photo?.content) {
        const savedPhoto = await this.fileService.saveFile(
          studentData.photo.content,
          studentData.photo.name,
          studentData.photo.type
        );
        studentData.photoId = savedPhoto.id;
      }

      // Gérer les documents
      let updatedDocuments = [...(existingStudent.documents || [])];

      // Vérifier si documents est un objet avec une propriété '0'
      const documentsArray = Array.isArray(studentData.documents)
        ? studentData.documents
        : Object.values(studentData.documents || {});

      if (documentsArray.length > 0) {
        console.log("4. Documents à traiter:", documentsArray.length);

        const newDocuments = await Promise.all(
          documentsArray
            .filter((doc: any) => doc && doc.content && doc.name && doc.type)
            .map(async (doc: any) => {
              console.log("5. Traitement du document:", doc.name);
              try {
                // Sauvegarder le fichier
                const savedDoc = await this.fileService.saveFile(
                  doc.content,
                  doc.name,
                  doc.type
                );

                // Créer la relation avec l'étudiant
                savedDoc.student = { id: studentId } as StudentEntity;

                // Sauvegarder avec la relation
                return await this.fileRepository.save(savedDoc);
              } catch (error) {
                console.error(
                  "Erreur lors de la sauvegarde du document:",
                  error
                );
                throw error;
              }
            })
        );

        console.log(
          "6. Documents sauvegardés:",
          newDocuments.map((d) => ({
            id: d.id,
            name: d.name,
          }))
        );

        updatedDocuments = [...updatedDocuments, ...newDocuments];
      }

      // Mettre à jour l'étudiant
      const updatedData = {
        ...existingStudent,
        ...studentData,
        documents: updatedDocuments,
      };

      // Sauvegarder les modifications
      await this.studentRepository.save(updatedData);

      // Récupérer l'étudiant mis à jour
      const updatedStudent = await this.studentRepository.findOne({
        where: { id: studentId },
        relations: ["photo", "documents"],
      });

      return {
        success: true,
        data: updatedStudent,
        error: null,
        message: Buffer.from("Étudiant mis à jour avec succès").toString(
          "base64"
        ),
      };
    } catch (error) {
      console.error("Erreur complète dans updateStudent:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Erreur inconnue",
        message: Buffer.from(`Échec de la mise à jour: ${error}`).toString(
          "base64"
        ),
      };
    }
  }

  async deleteStudent(studentId: number): Promise<ResultType> {
    try {
      // Recherche de l'étudiant par ID pour vérifier son existence
      const student = await this.studentRepository.findOne({
        where: { id: studentId },
      });

      if (!student) {
        return {
          success: false,
          data: null,
          error: "Étudiant non trouv",
          message: "Échec de la suppression : Étudiant non trouvé",
        };
      }

      // Suppression de l'étudiant
      await this.studentRepository.remove(student);

      return {
        success: true,
        data: null,
        error: null,
        message: "Étudiant supprimé avec succès",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Une erreur inconnue est survenue";
      console.error("Erreur dans deleteStudent:", error);
      return {
        success: false,
        data: null,
        error: errorMessage,
        message: `Échec de la suppression de l'étudiant : ${errorMessage}`,
      };
    }
  }

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

  async getTotalStudents(): Promise<ResultType> {
    try {
      const count = await this.studentRepository.count();
      return {
        success: true,
        data: count,
        message: "Nombre total d'étudiants récupéré avec succès",
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: "Erreur lors de la récupération du nombre d'étudiants",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async getStudents(): Promise<ResultType> {
    try {
      const dataSource = AppDataSource.getInstance();
      const studentRepo = dataSource.getRepository(StudentEntity);
      
      const students = await studentRepo.find({
        relations: ['grade', 'absences', 'payments'], // Inclure toutes les relations
        order: {
          lastname: 'ASC',
          firstname: 'ASC'
        }
      });

      return {
        success: true,
        data: students,
        message: "Liste des étudiants récupérée avec succès",
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: "Erreur lors de la récupération des étudiants",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async searchStudents(query: string): Promise<ResultType> {
    try {
      const students = await this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect('student.grade', 'grade')
        .where('LOWER(student.firstname) LIKE LOWER(:query)', { query: `%${query}%` })
        .orWhere('LOWER(student.lastname) LIKE LOWER(:query)', { query: `%${query}%` })
        .orWhere('LOWER(student.matricule) LIKE LOWER(:query)', { query: `%${query}%` })
        .orderBy('student.lastname', 'ASC')
        .addOrderBy('student.firstname', 'ASC')
        .getMany();

      return {
        success: true,
        data: students,
        message: "Étudiants trouvés avec succès",
        error: null
      };
    } catch (error) {
      console.error("Erreur dans searchStudents:", error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de la recherche des étudiants",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async getStudentsByGrade(gradeId: number): Promise<ResultType> {
    try {
      const students = await this.studentRepository.find({
        where: { grade: { id: gradeId } },
        relations: ['grade', 'photo'], // Ajout de la relation photo
        order: {
          lastname: 'ASC',
          firstname: 'ASC'
        }
      });

      // Charger les URLs des photos
      const studentsWithPhotos = await Promise.all(students.map(async (student) => {
        if (student.photo?.path) {
          try {
            const photoUrl = await this.fileService.getFileUrl(student.photo.id);
            return {
              ...student,
              photo: {
                ...student.photo,
                url: photoUrl
              }
            };
          } catch (error) {
            console.error(`Erreur lors du chargement de la photo pour l'étudiant ${student.id}:`, error);
            return student;
          }
        }
        return student;
      }));

      return {
        success: true,
        data: studentsWithPhotos,
        message: "Étudiants récupérés avec succès",
        error: null
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des étudiants:", error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de la récupération des étudiants",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      };
    }
  }
}
