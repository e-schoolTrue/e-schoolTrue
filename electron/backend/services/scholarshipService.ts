import { Scholarship, ScholarshipCreateInput } from '../types/scholarship';
import { Repository } from 'typeorm';
import { ScholarshipEntity } from '../entities/scholarship';
import { AppDataSource } from '../../data-source';
import { ResultType } from './paymentService';

export class ScholarshipService {
  private scholarshipRepository: Repository<ScholarshipEntity>;
 

  constructor() {
    this.scholarshipRepository = AppDataSource.getInstance().getRepository(ScholarshipEntity);
  }



  async getByStudent(studentId: number): Promise<ResultType<Scholarship[]>> {
    try {
      console.log('=== Recherche des bourses pour étudiant', studentId, '===');
      
      const scholarships = await this.scholarshipRepository.find({
        where: { studentId },
        order: { createdAt: 'DESC' }
      });

      console.log('Bourses trouvées:', scholarships);
      
      return {
        success: true,
        data: scholarships,
        message: scholarships.length ? "Bourses trouvées" : "Aucune bourse trouvée",
        error: null
      };
    } catch (error) {
      console.error('Erreur dans getByStudent:', error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de la récupération des bourses",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      };
    }
  }

  async assignScholarship(data: ScholarshipCreateInput): Promise<ResultType<Scholarship>> {
    try {
      console.log('=== Tentative d\'attribution de bourse ===');
      console.log('Données reçues:', data);

      // Désactiver les bourses existantes
      await this.scholarshipRepository.update(
        { studentId: data.studentId, isActive: true },
        { isActive: false }
      );

      // Créer la nouvelle bourse
      const scholarship = this.scholarshipRepository.create({
        studentId: data.studentId,
        percentage: data.percentage,
        reason: data.reason,
        schoolYear: new Date().getFullYear().toString(),
        isActive: true,
        createdAt: new Date()
      });

      const savedScholarship = await this.scholarshipRepository.save(scholarship);
      console.log('Bourse enregistrée:', savedScholarship);

      return {
        success: true,
        data: savedScholarship,
        message: "Bourse attribuée avec succès",
        error: null
      };
    } catch (error) {
      console.error('Erreur dans assignScholarship:', error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de l'attribution de la bourse",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      };
    }
  }
} 