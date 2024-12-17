import type { Student, SchoolInfo, ColorScheme } from '@/types/card';

interface PrintOptions {
  format: 'A4' | 'CR80';
  cardsPerPage: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export class CardPrintService {
  private static readonly DEFAULT_OPTIONS: PrintOptions = {
    format: 'A4',
    cardsPerPage: 8,
    margins: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10
    }
  };

  static generatePrintStyles(options: Partial<PrintOptions> = {}): string {
    const printOptions = { ...this.DEFAULT_OPTIONS, ...options };
    
    return `
      @page {
        size: ${printOptions.format};
        margin: ${printOptions.margins.top}mm ${printOptions.margins.right}mm ${printOptions.margins.bottom}mm ${printOptions.margins.left}mm;
      }

      @media print {
        body * {
          visibility: hidden;
        }
        
        .print-container, .print-container * {
          visibility: visible;
        }
        
        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        
        .card-item {
          page-break-inside: avoid;
          float: left;
          width: ${100 / (printOptions.cardsPerPage / 2)}%;
          padding: 5mm;
          box-sizing: border-box;
        }
      }
    `;
  }

  static async print(
    students: Student[],
    schoolInfo: SchoolInfo,
    colorScheme: ColorScheme,
    options?: Partial<PrintOptions>
  ): Promise<void> {
    // Créer une feuille de style pour l'impression
    const styleSheet = document.createElement('style');
    styleSheet.id = 'card-print-styles';
    styleSheet.textContent = this.generatePrintStyles(options);
    document.head.appendChild(styleSheet);

    try {
      // Lancer l'impression
      window.print();
    } finally {
      // Nettoyer les styles après l'impression
      document.head.removeChild(styleSheet);
    }
  }

  static async generatePDF(
    students: Student[],
    schoolInfo: SchoolInfo,
    colorScheme: ColorScheme,
    options?: Partial<PrintOptions>
  ): Promise<Blob> {
    // Ici, on pourrait implémenter la génération de PDF
    // en utilisant une bibliothèque comme jsPDF ou pdfmake
    throw new Error('PDF generation not implemented yet');
  }
} 