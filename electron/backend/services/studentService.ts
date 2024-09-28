import { Repository } from 'typeorm';
import { StudentEntity } from '#electron/backend/entities/students';
import { AppDataSource } from '#electron/data-source.ts';
import { ResultType } from '#electron/command';

export class StudentService {
  private studentRepository: Repository<StudentEntity>;

  constructor() {
    this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
  }

  async saveStudent(studentData: Partial<StudentEntity>): Promise<ResultType> {
    try {
      const newStudent = this.studentRepository.create(studentData);
      await this.studentRepository.save(newStudent);
      return { 
        success: true, 
        data: newStudent, 
        error: null, 
        message: 'Étudiant enregistré avec succès' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        data: null, 
        error: error.message, 
        message: 'Échec de l\'enregistrement' 
      };
    }
  }
  async getAllStudents(): Promise<any[]> {
    try {
        const students = await this.studentRepository.find({
            relations: ['photo'] // Charge explicitement la relation photo
        });
        return students;
    } catch (error: any) {
        throw new Error('Erreur lors de la récupération des étudiants: ' + error.message);
    }
}
}