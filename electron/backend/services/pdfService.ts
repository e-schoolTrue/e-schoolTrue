import { BrowserWindow } from 'electron';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    (timer as any)?.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export class PdfService {
  async generatePdf(htmlContent: string): Promise<Buffer> {
    let win: BrowserWindow | null = null;
    try {
      // Fenêtre invisible, sandboxée, sans intégration Node.
      win = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });

      await withTimeout(
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`),
        10000,
        'loadURL'
      );

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          win!.webContents.once('did-finish-load', () => resolve());
          win!.webContents.once('did-fail-load', (_e, code, desc) =>
            reject(new Error(`did-fail-load ${code}: ${desc}`))
          );
        }),
        10000,
        'did-finish-load'
      );

      // B5: printToPDF pur — uniquement les options supportées par Electron.
      const pdfBuffer: Buffer = await withTimeout(
        win.webContents.printToPDF({
          margins: { top: 10, bottom: 10, left: 10, right: 10 },
          pageSize: 'A4',
          printBackground: true
        }),
        10000,
        'printToPDF'
      );
      return pdfBuffer;
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      throw new Error('Erreur lors de la génération du PDF');
    } finally {
      try {
        if (win && !win.isDestroyed()) win.destroy();
      } catch {
        // ignore
      }
      win = null;
    }
  }

  async generatePdfWithPrintDialog(htmlContent: string): Promise<void> {
    let win: BrowserWindow | null = null;
    try {
      // Fenêtre visible d'impression, sandboxée, sans intégration Node.
      win = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });

      const safeContent = escapeHtml(htmlContent);
      const htmlWithPrintButton = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Fiche de Centralisation des Notes</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #333;
              font-size: 24px;
              margin-bottom: 10px;
            }
            .header-info {
              color: #666;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: center;
            }
            th {
              background-color: #2c3e50;
              color: white;
              font-weight: 600;
            }
            td:first-child, th:first-child {
              font-weight: bold;
              width: 100px;
            }
            td:nth-child(2), th:nth-child(2) {
              width: 120px;
            }
            .total-row td {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .average-row td {
              background-color: #e8f4f8;
              font-weight: bold;
              color: #2c3e50;
            }
            .print-section {
              margin-top: 30px;
              padding: 20px;
              background: #f9f9f9;
              border: 2px dashed #ccc;
              border-radius: 4px;
            }
            .print-btn {
              background: #4CAF50;
              color: white;
              border: none;
              padding: 15px 30px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              display: block;
              margin: 0 auto;
            }
            .print-btn:hover {
              background: #45a049;
            }
            .close-btn {
              background: #f44336;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 14px;
              border-radius: 4px;
              cursor: pointer;
              display: block;
              margin: 20px auto 0;
            }
            .close-btn:hover {
              background: #da190b;
            }
            @media print {
              body { background: white; padding: 0; }
              .print-section { display: none; }
              .container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Fiche de Centralisation des Notes</h1>
              <div class="header-info">
                École: ${safeContent}
              </div>
            </div>
            ${safeContent}
            <div class="print-section">
              <button class="print-btn" onclick="window.print()">Imprimer le PDF</button>
            </div>
          </div>
          <script>
            window.onafterprint = function() {
              setTimeout(() => {
                window.close();
              }, 1000);
            };
          </script>
        </body>
        </html>
      `;

      await withTimeout(
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlWithPrintButton)}`),
        10000,
        'loadURL'
      );
    } catch (error) {
      console.error('Erreur affichage PDF:', error);
      try {
        if (win && !win.isDestroyed()) win.destroy();
      } catch {
        // ignore
      }
      throw new Error('Erreur lors de l\'affichage du PDF');
    }
  }
}

export const pdfService = new PdfService();
export { escapeHtml };
