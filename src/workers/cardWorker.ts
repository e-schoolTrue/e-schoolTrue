// src/workers/cardWorker.ts (ou .js)
import { jsPDF } from 'jspdf';

interface CardImageData {
  frontImgData: string; // Data URL de l'image du recto
  backImgData: string;  // Data URL de l'image du verso
}

interface WorkerMessageData {
  allCardsData: CardImageData[]; // Un tableau de paires d'images pour toutes les cartes
  schoolName?: string;
}

self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
  const { allCardsData, schoolName } = event.data;

  if (!allCardsData || allCardsData.length === 0) {
    self.postMessage({ success: false, error: 'Aucune donnée d\'image reçue par le worker.' });
    return;
  }

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [54, 85.6], // Format carte de crédit CR80
    });
    pdf.setDocumentProperties({
        title: `Cartes Étudiants - ${schoolName || 'École'}`,
        // ... autres propriétés
    });

    allCardsData.forEach((cardData, index) => {
      pdf.addImage(cardData.frontImgData, 'JPEG', 0, 0, 85.6, 54);
      pdf.addPage();
      pdf.addImage(cardData.backImgData, 'JPEG', 0, 0, 85.6, 54);

      if (index < allCardsData.length - 1) {
        pdf.addPage(); // Page de séparation entre les PDF de chaque étudiant
      }
    });

    const pdfBlob = pdf.output('blob');
    self.postMessage({ success: true, blob: pdfBlob });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue dans le worker PDF';
    console.error('Erreur dans le worker PDF:', error);
    self.postMessage({ success: false, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
  }
};