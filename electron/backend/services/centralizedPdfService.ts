import { ResultType } from "./paymentService";
import { AppDataSource } from "../../data-source";
import { GradeConfigEntity } from "../entities/gradeConfig";
import { CourseEntity } from "../entities/course";
import { StudentEntity } from "../entities/students";
import { ConfigNoteService } from "./note-config-service";
import { CourseService } from "./courseService";
import { SchoolService } from "./schoolService";
import { YearRepartitionService } from "./yearService";
import { app, BrowserWindow } from 'electron';

interface CentralizedRankingData {
  studentId: number;
  matricule: string;
  firstname: string;
  lastname: string;
  generalAverage: number;
  rank: number;
  totalScores: number;
  averageScores: number;
  scores: Array<{
    courseId: number;
    courseName: string;
    score: number;
    coefficient: number;
    weightedScore: number;
  }>;
}

interface PdfService {
  generatePdfWithPrintDialog(htmlContent: string): Promise<void>;
}

export class CentralizedPdfService {
  private gradeConfigRepository: any;
  private configNoteService: ConfigNoteService;
  private courseService: CourseService;
  private schoolService: SchoolService;
  private yearService: YearRepartitionService;

  constructor() {
    this.gradeConfigRepository = AppDataSource.getInstance().getRepository(GradeConfigEntity);
    this.configNoteService = new ConfigNoteService();
    this.courseService = new CourseService();
    this.schoolService = new SchoolService();
    this.yearService = new YearRepartitionService();
  }

  async generateCentralizedGradesPdf(
    data: any,
    pdfService: PdfService
  ): Promise<ResultType<any>> {
    try {
      const schoolName = data.schoolInfo?.name || await this.schoolService.getSchool().then(r => r?.data?.name).catch(() => 'Mon École');
      const schoolAddress = data.schoolInfo?.address || '';
      const schoolPhone = data.schoolInfo?.phone || '';
      const schoolEmail = data.schoolInfo?.email || '';
      const schoolYear = data.schoolYear || await this.yearService.getCurrentYearRepartition().then(r => r?.data?.schoolYear).catch(() => '2024-2025');
      const period = data.filters?.period || 'Toutes';
      const className = data.classInfo?.name || 'Non spécifiée';
      const base = data.classInfo?.base || 20;
      const classAverage = data.classAverage || 0;
      const totalStudents = data.totalStudents || 0;

      const courses = data.courses?.map((c: any) => ({
        id: c.id,
        code: c.code || c.name,
        coefficient: c.coefficient
      })) || [];

      const rankingsData = data.rankings?.map((r: any) => ({
        studentId: r.studentId,
        matricule: r.matricule || '',
        firstname: r.firstname,
        lastname: r.lastname,
        generalAverage: r.generalAverage,
        rank: r.rank,
        totalScores: r.totalScores,
        averageScores: r.averageScores,
        scores: r.scores
      })) || [];

      const templateData = {
        schoolName,
        schoolAddress,
        schoolPhone,
        schoolEmail,
        schoolYear,
        period,
        className,
        base,
        courses,
        rankings: rankingsData,
        classAverage,
        totalStudents,
        title: 'REGISTRE DE CONSERVATION DES NOTES',
        subtitle: period,
        schoolLogoUrl: data.schoolInfo?.logo || null
      };

      const htmlContent = this.generateHtml(templateData);

      await pdfService.generatePdfWithPrintDialog(htmlContent);

      return {
        success: true,
        data: null,
        message: 'PDF généré avec succès',
        error: null
      };
    } catch (error) {
      console.error('Erreur génération PDF centralisé:', error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de la génération du PDF",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      };
    }
  }

  private generateHtml(data: any): string {
    const STUDENTS_PER_PAGE = 25;
    const totalStudents = data.rankings.length;
    const totalPages = Math.ceil(totalStudents / STUDENTS_PER_PAGE);
    
    let pagesHtml = '';
    
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIndex = pageIndex * STUDENTS_PER_PAGE;
      const endIndex = Math.min(startIndex + STUDENTS_PER_PAGE, totalStudents);
      const pageRankings = data.rankings.slice(startIndex, endIndex);
      const isFirstPage = pageIndex === 0;
      const isLastPage = pageIndex === totalPages - 1;
      
      pagesHtml += this.generatePageHtml(data, pageRankings, pageIndex + 1, totalPages, isFirstPage, isLastPage);
    }
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fiche de Centralisation des Notes</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: landscape;
      margin: 5mm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
    }

    .page {
      background: white;
      padding: 8px;
      min-height: 100vh;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Section 1: Trois colonnes */
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #333;
    }

    .header-left {
      flex: 1;
      text-align: left;
    }

    .header-center {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
    }

    .header-right {
      flex: 1;
      text-align: right;
    }

    .institution-info {
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      font-weight: 500;
    }

    .institution-info p {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .logo {
      width: 70px;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo img {
      max-width: 70px;
      max-height: 70px;
    }

    .logo-placeholder {
      width: 70px;
      height: 70px;
      background: #1a237e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 28px;
    }

    /* Section 2: Bandeau titre */
    .title-banner {
      background: #f8bbd0;
      border-radius: 6px;
      padding: 12px 20px;
      text-align: center;
      margin-bottom: 10px;
    }

    .title-banner h1 {
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }

    .title-banner .subtitle {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: #333;
    }

    /* Section 3: Infos complémentaires */
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: #000;
      margin-bottom: 10px;
      padding: 8px 15px;
      background: #e8eaf6;
      border-radius: 4px;
    }

    .page-info {
      font-size: 10px;
      color: #666;
    }

    /* Tableau */
    .table-container {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      table-layout: auto;
    }

    th, td {
      border: 1px solid #333;
      padding: 5px 6px;
      text-align: center;
    }

    th {
      background: #1a237e;
      color: white;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }

    td {
      background-color: white;
    }

    tr:nth-child(even) td {
      background-color: #f5f5f5;
    }

    .rank-cell {
      background: #1a237e !important;
      color: white;
      font-weight: bold;
    }

    .course-header {
      font-size: 9px;
      background: #3949ab;
    }

    .total-row td {
      background-color: #e8eaf6;
      font-weight: bold;
    }

    .average-row td {
      background-color: #c8e6c9;
      font-weight: bold;
      color: #2e7d32;
    }

    /* En-tête répété sur chaque page */
    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-footer-group;
    }

    tr {
      page-break-inside: avoid;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      body {
        background: white;
      }

      .page {
        box-shadow: none;
        padding: 5px;
      }

      .header-section {
        margin-bottom: 5px;
        padding-bottom: 4px;
      }

      .institution-info {
        font-size: 10px;
      }

      .logo, .logo-placeholder {
        width: 50px;
        height: 50px;
      }

      .logo-placeholder {
        font-size: 20px;
      }

      .title-banner {
        padding: 6px 15px;
        margin-bottom: 5px;
      }

      .title-banner h1 {
        font-size: 12px;
      }

      .title-banner .subtitle {
        font-size: 10px;
      }

      .info-row {
        font-size: 10px;
        padding: 5px 10px;
        margin-bottom: 5px;
      }

      th, td {
        padding: 3px 4px;
        font-size: 8px;
      }
    }
  </style>
</head>
<body>
  ${pagesHtml}

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 300);
    };

    window.onafterprint = function() {
      setTimeout(() => {
        window.close();
      }, 500);
    };
  </script>
</body>
</html>
    `;
  }

  private generatePageHtml(data: any, pageRankings: any[], pageNumber: number, totalPages: number, isFirstPage: boolean, isLastPage: boolean): string {
    return `
  <div class="page">
    ${isFirstPage ? `
    <!-- Section 1: Trois colonnes -->
    <div class="header-section">
      <div class="header-left">
        <div class="institution-info">
          <p>MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
          <p>${data.schoolName}</p>
          ${data.schoolAddress ? `<p>${data.schoolAddress}</p>` : ''}
          ${data.schoolPhone ? `<p>Tél: ${data.schoolPhone}</p>` : ''}
        </div>
      </div>
      <div class="header-center">
        <div class="logo">
          ${data.schoolLogoUrl ? `<img src="${data.schoolLogoUrl}" alt="Logo">` : '<div class="logo-placeholder">🏫</div>'}
        </div>
      </div>
      <div class="header-right">
        <div class="institution-info">
          <p> RÉPUBLIQUE DE GUINÉE</p>
          <p>TRAVAIL - JUSTICE - SOLIDARITÉ</p>
          <p>MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
        </div>
      </div>
    </div>

    <!-- Section 2: Bandeau titre -->
    <div class="title-banner">
      <h1>${data.title || 'REGISTRE DE CONSERVATION DES NOTES'}</h1>
      <div class="subtitle">${data.subtitle || data.period}</div>
    </div>

    <!-- Section 3: Infos complémentaires -->
    <div class="info-row">
      <span>Classe : ${data.className}</span>
      <span>Année Scolaire : ${data.schoolYear}</span>
    </div>
    ` : `
    <div class="header-section">
      <div class="header-left">
        <div class="institution-info">
          <p>${data.schoolName}</p>
        </div>
      </div>
      <div class="header-center">
        <div class="title-banner" style="margin-bottom: 0; padding: 6px 15px;">
          <h1 style="font-size: 12px;">${data.title || 'REGISTRE DE CONSERVATION DES NOTES'}</h1>
        </div>
      </div>
      <div class="header-right" style="text-align: right;">
        <span class="page-info">Page ${pageNumber} / ${totalPages}</span>
      </div>
    </div>
    `}

    <!-- Tableau -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="rank-cell">RANG</th>
            <th class="rank-cell">MATRICULE</th>
            <th class="rank-cell">PRÉNOM</th>
            <th class="rank-cell">NOM</th>
            ${data.courses.map((c: any) => `<th class="course-header">${c.code || c.id}</th>`).join('')}
            <th class="rank-cell">COEF</th>
            <th class="rank-cell">MOYENNE</th>
          </tr>
        </thead>
        <tbody>
          ${pageRankings.map((r: any) => `
            <tr>
              <td class="rank-cell">${r.rank}</td>
              <td>${r.matricule || '-'}</td>
              <td>${r.firstname}</td>
              <td>${r.lastname}</td>
              ${data.courses.map((c: any) => {
                const score = r.scores?.find((s: any) => s.courseId === c.id);
                return `<td>${score ? score.score.toFixed(1) : '-'}</td>`;
              }).join('')}
              <td>${r.totalScores}</td>
              <td class="average-row">${r.generalAverage.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        ${isLastPage ? `
        <tfoot>
          <tr class="total-row">
            <td colspan="4">MOYENNE GÉNÉRALE DE LA CLASSE</td>
            ${data.courses.map(() => `<td>-</td>`).join('')}
            <td colspan="2">${data.classAverage.toFixed(2)} / ${data.base}</td>
          </tr>
        </tfoot>
        ` : ''}
      </table>
    </div>
    
    ${!isLastPage ? `
    <div class="info-row" style="margin-top: 8px;">
      <span>Suite page ${pageNumber}</span>
      <span class="page-info">Page ${pageNumber} / ${totalPages}</span>
    </div>
    ` : ''}
  </div>
    `;
  }
}
