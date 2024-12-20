import type { ResultType } from '#/types';

export interface ReportConfiguration {
  gradeId: number;
  courseId: number;
  maxNote: number;
  minNote: number;
  passingGrade: number;
  coefficients: Record<string, number>;
}

export class ReportService {
  async saveConfiguration(config: ReportConfiguration): Promise<ResultType> {
    try {
      const result = await window.ipcRenderer.invoke('report:saveConfig', config);
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        message: 'Erreur lors de la sauvegarde de la configuration',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  async getConfiguration(gradeId: number): Promise<ResultType> {
    try {
      const result = await window.ipcRenderer.invoke('report:getConfig', gradeId);
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        message: 'Erreur lors de la récupération de la configuration',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  async generateReport(studentId: number, period: string): Promise<ResultType> {
    try {
      const result = await window.ipcRenderer.invoke('report:generate', {
        studentId,
        period
      });
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        message: 'Erreur lors de la génération du bulletin',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }
} 