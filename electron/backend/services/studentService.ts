import { Repository } from 'typeorm';
import { StudentEntity } from '../entities/students';
import { ClassRoomEntity } from '../entities/grade';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';

export class StudentService {
  private studentRepository: Repository<StudentEntity>;
  private classRepository: Repository<ClassRoomEntity>;
  private fileRepository: Repository<FileEntity>;

  constructor() {
    this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
    this.classRepository = AppDataSource.getInstance().getRepository(ClassRoomEntity);
    this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
  }

  async saveStudent(studentData: Partial<StudentEntity>): Promise<ResultType> {
    try {
      console.log("Données reçues pour l'enregistrement de l'étudiant:", studentData);

      // Vérifier si la photo existe
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

      // Vérifier si la classe existe
      if (studentData.classId) {
        const classExists = await this.classRepository.findOne({ where: { id: studentData.classId } });
        if (!classExists) {
          return {
            success: false,
            data: null,
            error: "La classe spécifiée n'existe pas",
            message: "Erreur lors de l'enregistrement de l'étudiant : La classe spécifiée n'existe pas"
          };
        }
      }

      // Nettoyer les données
      const cleanedData: Partial<StudentEntity> = {};
      for (const [key, value] of Object.entries(studentData)) {
        if (value !== null && value !== undefined) {
          cleanedData[key as keyof StudentEntity] = value;
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
    } catch (error: any) {
      console.error("Erreur dans saveStudent:", error);
      return {
        success: false,
        data: null,
        error: error.message,
        message: `Échec de l'enregistrement de l'étudiant : ${error.message}`
      };
    }
  }

  async getAllStudents(): Promise<StudentEntity[]> {
    try {
      console.log("Début de getAllStudents");
      console.log("Connexion à la base de données:", AppDataSource.getInstance().isInitialized);
      const students = await this.studentRepository.find({
        relations: ['photo', 'class']
      });
      console.log("Requête SQL exécute:", this.studentRepository.createQueryBuilder().getSql());
      console.log("Nombre d'étudiants trouvés:", students.length);
      console.log("Premier étudiant (si existe):", students[0]);
      return students;
    } catch (error: any) {
      console.error('Erreur détaillée dans getAllStudents:', error);
      throw new Error('Erreur lors de la récupération des étudiants: ' + error.message);
    }
  }

  async getStudentDetails(studentId: number): Promise<any> {
    try {
      console.log(`Tentative de récupération des détails de l'étudiant avec l'ID: ${studentId}`);
      const student = await this.studentRepository.findOneOrFail({
        where: { id: studentId },
        relations: ['photo', 'documents', 'class']
      });

      console.log("Étudiant trouvé:", student);

      const studentDetails = {
        ...student,
        photo: student.photo ? { id: student.photo.id, name: student.photo.name } : null,
        documents: student.documents ? student.documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.type
        })) : [],
        className: student.class ? student.class.name : null,
      };

      console.log("Détails de l'étudiant préparés:", studentDetails);
      return studentDetails;
    } catch (error) {
      console.error('Erreur dans getStudentDetails:', error);
      throw error;
    }
  }

  async getAvailableLevelsAndFees(): Promise<ResultType> {
    try {
      const classRooms = await this.classRepository.find();
      const levelsAndFees = classRooms.map(room => ({
        level: room.name,
        inscriptionFees: room.inscriptionFees,
        annualFees: room.annualFees
      }));

      return {
        success: true,
        data: levelsAndFees,
        error: null,
        message: Buffer.from('Niveaux et frais récupérés avec succès').toString('base64')
      };
    } catch (error: any) {
      console.error("Erreur dans getAvailableLevelsAndFees:", error);
      return {
        success: false,
        data: null,
        error: error.message,
        message: Buffer.from(`Échec de la récupération des niveaux et frais: ${error.message}`).toString('base64')
      };
    }
  }

  async updateStudent(studentId: number, studentData: Partial<StudentEntity>): Promise<ResultType> {
    try {
      const existingStudent = await this.studentRepository.findOne({ where: { id: studentId } });
      if (!existingStudent) {
        throw new Error("Étudiant non trouvé");
      }

      // Mettre à jour les propriétés de l'étudiant existant
      Object.assign(existingStudent, studentData);

      const updatedStudent = await this.studentRepository.save(existingStudent);
      console.log("Étudiant mis à jour:", updatedStudent);

      return {
        success: true,
        data: updatedStudent,
        error: null,
        message: Buffer.from('Étudiant mis à jour avec succès').toString('base64')
      };
    } catch (error: any) {
      console.error("Erreur dans updateStudent:", error);
      return {
        success: false,
        data: null,
        error: error.message,
        message: Buffer.from(`Échec de la mise à jour: ${error.message}`).toString('base64')
      };
    }
  }
}
