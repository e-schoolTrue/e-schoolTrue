export const useCardPrintStyles = (colorScheme: any) => {
  return `
    .card-template {
      width: 85.6mm;
      height: 54mm;
      background: white;
      position: relative;
      overflow: hidden;
    }
    
    .card-front {
      width: 100%;
      height: 100%;
      padding: 10px;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .school-logo {
      width: 30px;
      height: 30px;
      object-fit: contain;
    }
    
    .school-name {
      font-size: 14px;
      color: ${colorScheme.primary};
      margin: 0;
    }
    
    .content {
      display: flex;
      gap: 15px;
      flex: 1;
    }
    
    .photo-section {
      width: 35mm;
    }
    
    .student-photo {
      width: 100%;
      height: 40mm;
      object-fit: cover;
      border: 1px solid #ddd;
    }
    
    .details {
      flex: 1;
    }
    
    .student-name {
      font-size: 16px;
      margin: 0 0 5px 0;
      color: ${colorScheme.secondary};
    }
    
    .info-text {
      font-size: 12px;
      margin: 3px 0;
      color: #666;
    }
  `;
}; 