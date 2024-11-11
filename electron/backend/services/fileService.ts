import { Repository } from 'typeorm';
import { FileEntity } from '../entities/file';
import { AppDataSource } from '../../data-source';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FileResponse {
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
            // Extraire le contenu base64 réel (supprimer le préfixe data:image/...;base64,)
            const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
            
            // Convertir en Buffer
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Créer un nom de fichier unique
            const fileName = `${Date.now()}-${name}`;
            const filePath = path.join(this.uploadDir, fileName);

            // Écrire le fichier
            await fs.writeFile(filePath, buffer);
            console.log("Fichier sauvegardé:", filePath);

            // Créer l'entité File
            const fileData: Partial<FileEntity> = {
                name: name,
                path: filePath,
                type: type
            };

            const file = this.fileRepository.create(fileData);
            return await this.fileRepository.save(file);
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

    async saveDocuments(documents: any[], studentId: number): Promise<FileEntity[]> {
        const savedDocuments: FileEntity[] = [];
        
        for (const doc of documents) {
            try {
                const base64Data = doc.content.replace(/^data:.*?;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                
                const fileName = `${Date.now()}-${doc.name}`;
                const filePath = path.join(this.uploadDir, fileName);
                
                await fs.writeFile(filePath, buffer);
                
                const fileEntity = this.fileRepository.create({
                    name: doc.name,
                    path: filePath,
                    type: doc.type,
                    student: { id: studentId }
                });
                
                const savedDoc = await this.fileRepository.save(fileEntity);
                savedDocuments.push(savedDoc);
            } catch (error) {
                console.error(`Erreur lors de la sauvegarde du document ${doc.name}:`, error);
            }
        }
        
        return savedDocuments;
    }
}
