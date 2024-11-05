import { Repository } from 'typeorm';
import { StudentEntity } from '../entities/students';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';

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

  constructor() {
    this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
    this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
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
        .filter((doc): doc is Required<Pick<FileEntity, 'id' | 'name' | 'type'>> => 
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

  async updateStudent(studentId: number, studentData: Partial<Omit<StudentEntity, 'id'>>): Promise<ResultType> {
    try {
      const existingStudent = await this.studentRepository.findOne({ 
        where: { id: studentId } 
      });
      
      if (!existingStudent) {
        throw new Error("Étudiant non trouvé");
      }

      const updatedData: Partial<StudentEntity> = {};
      for (const [key, value] of Object.entries(studentData)) {
        if (value !== null && value !== undefined) {
          (updatedData as any)[key] = value;
        }
      }

      const updatedStudent = await this.studentRepository.save({
        ...existingStudent,
        ...updatedData
      });

      return {
        success: true,
        data: updatedStudent,
        error: null,
        message: Buffer.from('Étudiant mis à jour avec succès').toString('base64')
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error("Erreur dans updateStudent:", error);
      return {
        success: false,
        data: null,
        error: errorMessage,
        message: Buffer.from(`Échec de la mise à jour: ${errorMessage}`).toString('base64')
      };
    }
  }
}