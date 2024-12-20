import { Repository } from 'typeorm';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import * as fs from 'fs/promises';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { ResultType } from '#electron/command';

interface FileResponse {
    id: number;       // Ajout de l'id dans l'interface
    content: Buffer;
    type: string;
    name: string;
    path: string;
}

export class FileService {
    private fileRepository: Repository<FileEntity>;
    private uploadDir: string;

    constructor() {
        this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
        this.uploadDir = path.join(__dirname, '..', '..', 'uploads');
        fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
    }

    async saveFile(content: string, name: string, type: string): Promise<FileEntity> {
        try {
            // Nettoyer les données base64
            const base64Data = content.replace(/^data:.*?;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Créer un nom de fichier unique
            const fileName = `${Date.now()}-${name}`;
            const filePath = path.join(this.uploadDir, fileName);
            
            // Écrire le fichier
            await fs.writeFile(filePath, buffer);
            
            // Créer et sauvegarder l'entité
            const fileEntity = this.fileRepository.create({
                name,
                path: filePath,
                type
            });
            
            return await this.fileRepository.save(fileEntity);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du fichier:', error);
            throw error;
        }
    }

    async getFileById(fileId: number): Promise<FileResponse | null> {
        try {
            const file = await this.fileRepository.findOne({ where: { id: fileId } });
            if (!file || !file.path || !file.type || !file.name) {
                console.log("Fichier non trouvé ou données manquantes");
                return null;
            }

            console.log("Lecture du fichier:", file.path);
            const content = await fs.readFile(file.path);
            console.log("Taille du fichier:", content.length, "bytes");
            console.log("Type du fichier:", file.type);

            return {
                id: file.id,    // Ajout de l'id dans la réponse
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

    async saveDocuments(documents: any[], professorId: number): Promise<FileEntity[]> {
        const savedDocuments: FileEntity[] = [];
        
        for (const doc of documents) {
            try {
                // Nettoyer les données base64
                const base64Data = doc.content.replace(/^data:.*?;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Créer un nom de fichier unique
                const fileName = `${Date.now()}-${doc.name}`;
                const filePath = path.join(this.uploadDir, fileName);
                
                // Écrire le fichier
                await fs.writeFile(filePath, buffer);
                console.log("Document sauvegardé:", filePath);
                
                // Créer l'entité
                const fileEntity = this.fileRepository.create({
                    name: doc.name,
                    path: filePath,
                    type: doc.type,
                    professor: { id: professorId }
                });
                
                const savedDoc = await this.fileRepository.save(fileEntity);
                console.log("Document enregistré en DB:", savedDoc);
                savedDocuments.push(savedDoc);
            } catch (error) {
                console.error(`Erreur lors de la sauvegarde du document ${doc.name}:`, error);
            }
        }
        
        return savedDocuments;
    }

    async getFileUrl(filePath: string): Promise<{ content: string; type: string }> {
        try {
            console.log("Lecture du fichier:", filePath);
            // Lire le fichier en tant que buffer
            const buffer = await fs.readFile(filePath);
            const type = this.getMimeType(filePath);
            
            console.log("Type MIME:", type);
            console.log("Taille du fichier:", buffer.length, "bytes");

            if (buffer.length === 0) {
                throw new Error('Fichier vide');
            }

            // Convertir directement le buffer en base64
            const base64Content = buffer.toString('base64');

            // Pour les PDFs, ajouter le préfixe data URL
            const content = type === 'application/pdf' 
                ? `data:application/pdf;base64,${base64Content}`
                : base64Content;

            return { content, type };
        } catch (error) {
            console.error('Erreur lors de la récupération du fichier:', error);
            throw error;
        }
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
        
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        console.log(`Extension: ${ext}, Type MIME: ${mimeType}`);
        return mimeType;
    }

    async getImageUrl(filePath: string): Promise<ResultType> {
        try {
            const buffer = await readFile(filePath);
            const base64 = buffer.toString('base64');
            const mimeType = this.getMimeType(filePath);
            
            return {
                success: true,
                data: `data:${mimeType};base64,${base64}`,
                message: 'Image chargée avec succès',
                error: null
            };
        } catch (error) {
            console.error('Erreur lors du chargement de l\'image:', error);
            return {
                success: false,
                data: null,
                message: 'Erreur lors du chargement de l\'image',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            };
        }
    }
}