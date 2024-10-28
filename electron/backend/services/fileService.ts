import { Repository } from 'typeorm';
import { FileEntity } from '#electron/backend/entities/file';
import { StudentEntity } from '#electron/backend/entities/students';
import { AppDataSource } from '#electron/data-source';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export class FileService {
    private fileRepository: Repository<FileEntity>;
    private studentRepository: Repository<StudentEntity>;
    private uploadDir: string;

    constructor() {
        this.fileRepository = AppDataSource.getInstance().getRepository(FileEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.uploadDir = path.join(app.getPath('userData'), 'uploads');
        fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
    }

    async saveFile(content: string, name: string, type: string): Promise<FileEntity> {
        const fileName = `${Date.now()}-${name}`;
        const filePath = path.join(this.uploadDir, fileName);

        const fileData: Partial<FileEntity> = {
            name,
            path: filePath,
            type
        };

        const file = this.fileRepository.create(fileData);

        // Écrire le contenu du fichier
        await fs.writeFile(filePath, content);

        // Sauvegarder les métadonnées du fichier dans la base de données
        return await this.fileRepository.save(file);
    }

    async getFileById(id: number): Promise<FileEntity | null> {
        return await this.fileRepository.findOne({ where: { id } });
    }

    async getFileContent(id: number): Promise<Buffer | null> {
        const file = await this.getFileById(id);
        if (file && file.path) {
            return await fs.readFile(file.path);
        }
        return null;
    }

    async associateFileWithStudent(fileId: number, studentId: number): Promise<void> {
        const file = await this.fileRepository.findOne({ where: { id: fileId } });
        const student = await this.studentRepository.findOne({ where: { id: studentId } });

        if (file && student) {
            file.student = student;
            await this.fileRepository.save(file);
        } else {
            console.warn(`Impossible d'associer le fichier (ID: ${fileId}) à l'étudiant (ID: ${studentId}). L'un des deux n'existe pas.`);
        }
    }
}
