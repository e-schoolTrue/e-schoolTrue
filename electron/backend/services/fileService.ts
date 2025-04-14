import { Repository } from 'typeorm';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    IFileResponse,
    IFileServiceParams
} from '../types/file';

export class FileService {
    private fileRepository: Repository<FileEntity>;
    private uploadDir: string;

    constructor() {
        this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
        this.uploadDir = path.resolve(process.cwd(), 'uploads');
        this.initializeUploadDir();
    }

    private async initializeUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
        } catch (error) {
            console.error('Erreur lors de la création du dossier uploads:', error);
            throw error;
        }
    }

    private async ensureFileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private getRelativePath(absolutePath: string): string {
        return path.relative(process.cwd(), absolutePath);
    }

    private getAbsolutePath(relativePath: string): string {
        return path.resolve(process.cwd(), relativePath);
    }

    async saveFile(fileData: IFileServiceParams['saveFile']): Promise<FileEntity> {
        try {
            const base64Data = fileData.content.replace(/^data:.*?;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const fileName = `${Date.now()}-${fileData.name}`;
            const filePath = path.join(this.uploadDir, fileName);
            
            await fs.writeFile(filePath, buffer);
            
            const fileEntity = this.fileRepository.create({
                name: fileData.name,
                path: filePath,
                type: fileData.type
            });
            
            return await this.fileRepository.save(fileEntity);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du fichier:', error);
            throw error;
        }
    }

    private sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    async getFileById(params: IFileServiceParams['getFileById']): Promise<IFileResponse | null> {
        try {
            const file = await this.fileRepository.findOne({ where: { id: params.fileId } });
            if (!file || !file.path || !file.type || !file.name) {
                console.log("Fichier non trouvé ou données manquantes");
                return null;
            }

            const absolutePath = this.getAbsolutePath(file.path);
            if (!await this.ensureFileExists(absolutePath)) {
                console.log("Fichier physique non trouvé:", absolutePath);
                return null;
            }

            const content = await fs.readFile(absolutePath);
            
            return {
                id: file.id,
                content,
                type: file.type,
                name: file.name,
                path: file.path
            };
        } catch (error) {
            console.error('Erreur lors de la récupération du fichier:', error);
            return null;
        }
    }

    async saveDocuments(params: IFileServiceParams['saveDocuments']): Promise<FileEntity[]> {
        const savedDocuments: FileEntity[] = [];
        
        for (const doc of params.documents) {
            try {
                const base64Data = doc.content.replace(/^data:.*?;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                
                const fileName = `${Date.now()}-${this.sanitizeFileName(doc.name)}`;
                const filePath = path.join(this.uploadDir, fileName);
                
                await fs.writeFile(filePath, buffer);
                
                const fileEntity = this.fileRepository.create({
                    name: doc.name,
                    path: this.getRelativePath(filePath),
                    type: doc.type,
                    professor: { id: params.professorId }
                });
                
                const savedDoc = await this.fileRepository.save(fileEntity);
                savedDocuments.push(savedDoc);
            } catch (error) {
                console.error(`Erreur lors de la sauvegarde du document ${doc.name}:`, error);
            }
        }
        
        return savedDocuments;
    }

    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async getFileUrl(params: IFileServiceParams['getFileUrl']): Promise<string> {
        const file = await this.fileRepository.findOne({ where: { id: params.fileId } });
        if (!file) {
            throw new Error('File not found in database');
        }

        const absolutePath = this.getAbsolutePath(file.path);
        if (!await this.ensureFileExists(absolutePath)) {
            throw new Error('Physical file not found');
        }

        const fileContent = await fs.readFile(absolutePath);
        const base64 = fileContent.toString('base64');
        const mimeType = this.getMimeType(file.path);

        return `data:${mimeType};base64,${base64}`;
    }
}