import { Repository } from 'typeorm';
import { StudentEntity } from '../entities/students';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';
import { FileService } from './fileService';

// Déplacer l'interface en dehors de la classe
interface StudentDetailsResponse {
  id: number;
  firstname?: string;
  lastname?: string;
  matricule?: string;
  birthDay?: Date;
  birthPlace?: string;
  address?: string;
  famillyPhone?: string;
  personalPhone?: string;
  sex?: 'male' | 'female';
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
}

export class StudentService {
  private studentRepository: Repository<StudentEntity>;
  private fileRepository: Repository<FileEntity>;
  private fileService: FileService;

  constructor() {
    this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
    this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
    this.fileService = new FileService();
  }

  async saveStudent(studentData: Partial<StudentEntity>): Promise<ResultType> {
    try {
      console.log("Données reçues pour l'enregistrement de l'étudiant:", studentData);

      if (studentData.photoId) {
        const photoExists = await this.fileRepository.findOne({ where: { id: studentData.photoId } });
        if (!photoExists) {
          return {
            success: false,
            data: null,
            error: "La photo spécifiée n'existe pas",
            message: "Erreur lors de l'enregistrement de l'étudiant : La photo spécifiée n'existe pas"
          };
        }
      }

      const cleanedData: Partial<StudentEntity> = {};
      for (const [key, value] of Object.entries(studentData)) {
        if (value !== null && value !== undefined) {
          (cleanedData as any)[key] = value;
        }
      }

      const student = this.studentRepository.create(cleanedData);
      const savedStudent = await this.studentRepository.save(student);

      return {
        success: true,
        data: savedStudent,
        error: null,
        message: "Étudiant enregistré avec succès"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error("Erreur dans saveStudent:", error);
      return {
        success: false,
        data: null,
        error: errorMessage,
        message: `Échec de l'enregistrement de l'étudiant : ${errorMessage}`
      };
    }
  }

  async getAllStudents(): Promise<StudentEntity[]> {
    try {
      return await this.studentRepository.find({
        relations: ['photo', 'documents']
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error('Erreur détaillée dans getAllStudents:', error);
      throw new Error('Erreur lors de la récupération des étudiants: ' + errorMessage);
    }
  }

  async getStudentDetails(studentId: number): Promise<StudentDetailsResponse> {
    try {
      const student = await this.studentRepository.findOneOrFail({
        where: { id: studentId },
        relations: ['photo', 'documents']
      });

      // Traitement de la photo avec vérification de null/undefined
      const photoData = student.photo && student.photo.id && student.photo.name && student.photo.type
        ? {
            id: student.photo.id,
            name: student.photo.name,
            type: student.photo.type
          }
        : null;

      // Traitement des documents avec vérification de null/undefined
      const documentsData = (student.documents ?? [])
        .filter((doc): doc is FileEntity => 
          Boolean(doc?.id && doc?.name && doc?.type)
        )
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type
        }));

      const response: StudentDetailsResponse = {
        id: student.id,
        firstname: student.firstname,
        lastname: student.lastname,
        matricule: student.matricule,
        birthDay: student.birthDay,
        birthPlace: student.birthPlace,
        address: student.address,
        famillyPhone: student.famillyPhone,
        personalPhone: student.personalPhone,
        sex: student.sex,
        schoolYear: student.schoolYear,
        photo: photoData,
        documents: documentsData
      };

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error('Erreur dans getStudentDetails:', error);
      throw new Error(`Erreur lors de la récupération des détails de l'étudiant: ${errorMessage}`);
    }
  }

  async updateStudent(studentId: number, studentData: any): Promise<ResultType> {
    try {
        console.log("1. Données reçues pour mise à jour:", JSON.stringify({
            ...studentData,
            documents: studentData.documents ? studentData.documents.map((d: any) => ({
                name: d.name,
                type: d.type,
                hasContent: !!d.content?.length
            })) : []
        }, null, 2));

        const existingStudent = await this.studentRepository.findOne({ 
            where: { id: studentId },
            relations: ['photo', 'documents']
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
                            console.error("Erreur lors de la sauvegarde du document:", error);
                            throw error;
                        }
                    })
            );

            console.log("6. Documents sauvegardés:", newDocuments.map(d => ({
                id: d.id,
                name: d.name
            })));

            updatedDocuments = [...updatedDocuments, ...newDocuments];
        }

        // Mettre à jour l'étudiant
        const updatedData = {
            ...existingStudent,
            ...studentData,
            documents: updatedDocuments
        };

        // Sauvegarder les modifications
        await this.studentRepository.save(updatedData);

        // Récupérer l'étudiant mis à jour
        const updatedStudent = await this.studentRepository.findOne({
            where: { id: studentId },
            relations: ['photo', 'documents']
        });

        return {
            success: true,
            data: updatedStudent,
            error: null,
            message: Buffer.from('Étudiant mis à jour avec succès').toString('base64')
        };
    } catch (error) {
        console.error("Erreur complète dans updateStudent:", error);
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Erreur inconnue",
            message: Buffer.from(`Échec de la mise à jour: ${error}`).toString('base64')
        };
    }
  }


  async deleteStudent(studentId: number): Promise<ResultType> {
    try {
      // Recherche de l'étudiant par ID pour vérifier son existence
      const student = await this.studentRepository.findOne({ where: { id: studentId } });
  
      if (!student) {
        return {
          success: false,
          data: null,
          error: "Étudiant non trouv",
          message: "Échec de la suppression : Étudiant non trouvé"
        };
      }
  
      // Suppression de l'étudiant
      await this.studentRepository.remove(student);
  
      return {
        success: true,
        data: null,
        error: null,
        message: "Étudiant supprimé avec succès"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error("Erreur dans deleteStudent:", error);
      return {
        success: false,
        data: null,
        error: errorMessage,
        message: `Échec de la suppression de l'étudiant : ${errorMessage}`
      };
    }
  }

  async createStudent(studentData: any): Promise<ResultType> {
    try {
        // Gérer la photo d'abord si elle existe
        let photoId: number | undefined;
        if (studentData.photo && studentData.photo.content) {
            const savedPhoto = await this.fileService.saveFile(
                studentData.photo.content,
                studentData.photo.name,
                studentData.photo.type
            );
            photoId = savedPhoto.id;
        }

        // Créer l'objet étudiant avec les données structurées
        const studentToCreate: Partial<StudentEntity> = {
            firstname: studentData.firstname,
            lastname: studentData.lastname,
            matricule: studentData.matricule,
            fatherFirstname: studentData.fatherFirstname,
            fatherLastname: studentData.fatherLastname,
            motherFirstname: studentData.motherFirstname,
            motherLastname: studentData.motherLastname,
            birthDay: studentData.birthDay ? new Date(studentData.birthDay) : undefined,
            birthPlace: studentData.birthPlace,
            address: studentData.address,
            famillyPhone: studentData.famillyPhone,
            personalPhone: studentData.personalPhone,
            classId: studentData.classId,
            sex: studentData.sex as 'male' | 'female',
            schoolYear: studentData.schoolYear,
            photoId: photoId
        };

        // Créer et sauvegarder l'étudiant
        const newStudent = this.studentRepository.create(studentToCreate);
        const savedStudent = await this.studentRepository.save(newStudent);

        // Gérer les documents si ils existent
        if (studentData.documents && Array.isArray(studentData.documents) && studentData.documents.length > 0) {
            await this.fileService.saveDocuments(studentData.documents, savedStudent.id);
        }

        // Récupérer l'étudiant avec toutes ses relations
        const studentWithRelations = await this.studentRepository.findOne({
            where: { id: savedStudent.id },
            relations: ['photo', 'documents']
        });

        console.log("Étudiant sauvegardé avec succès:", studentWithRelations);

        return {
            success: true,
            data: studentWithRelations,
            message: "Étudiant créé avec succès",
            error: null
        };
    } catch (error) {
        console.error("Erreur détaillée dans createStudent:", error);
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Erreur inconnue",
            message: "Échec de la création de l'étudiant"
        };
    }
  }

  async getStudentById(id: number): Promise<StudentEntity | null> {
    return await this.studentRepository.findOne({
        where: { id },
        relations: ['absences']  // Inclure la relation avec les absences
    });
}
}