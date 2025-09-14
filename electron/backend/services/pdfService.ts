import puppeteer, { Browser, Page } from 'puppeteer-core';
import { app } from 'electron';
import path from 'path';

export class PdfService {
    private async getBrowser(): Promise<Browser> {
        const executablePath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'puppeteer', '.local-chromium')
            : path.join(process.cwd(), 'node_modules', 'puppeteer', '.local-chromium');
            
        // Find the correct revision folder
        const fs = require('fs');
        const revisions = fs.readdirSync(executablePath);
        const revision = revisions.find(r => r.startsWith('win64-')); // Adjust for other platforms if needed
        
        if (!revision) {
            throw new Error('Chromium revision not found for Puppeteer.');
        }

        const finalExecutablePath = path.join(executablePath, revision, 'chrome-win', 'chrome.exe');

        return puppeteer.launch({
            executablePath: finalExecutablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }

    async generatePdf(htmlContent: string): Promise<Buffer> {
        let browser: Browser | null = null;
        try {
            browser = await this.getBrowser();
            const page: Page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            return pdfBuffer;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
