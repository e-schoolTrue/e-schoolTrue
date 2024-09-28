import {AppDataSource} from "../../data-source.ts";
import {FileEntity} from "../entities/file.ts";
import {Repository} from "typeorm";
import {readFileSync, writeFileSync} from 'node:fs';
import {getFileMimeType} from "../utils.ts";
import {ResponseType} from "../types";

export class FileService {
    private fileRepository: Repository<FileEntity>;

    constructor() {
        // Récupérer l'instance de DataSource avant d'appeler getRepository
        const dataSource = AppDataSource.getInstance(); 
        this.fileRepository = dataSource.getRepository(FileEntity);
    }

    async readFile(filePath: string, name: string): Promise<ResponseType> {
        const fileData = await this.fileRepository.findBy({ name });
        try {
            if (fileData.length > 0 && fileData[0].content) {
                writeFileSync(filePath, fileData[0].content); // Correction: content est un Buffer
                return {
                    data: fileData[0],
                    success: true,
                    message: "Fichier trouvé avec succès",
                    error: null
                };
            } else {
                return {
                    data: null,
                    success: false,
                    message: "Erreur lors de la recherche du fichier",
                    error: null
                };
            }
        } catch (e) {
            console.log("Erreur : ", e);
            return {
                data: null,
                success: false,
                message: "Erreur lors de l'écriture dans le fichier. Vérifiez que le chemin existe",
                error: null
            };
        }
    }

    async storeFile(filePath: string, name: string) {
        const data = readFileSync(filePath); // data est un Buffer
        const headerArray = data.subarray(0, 4);
        let header = "";
        for (let i = 0; i < headerArray.length; i++) {
            header += headerArray[i].toString(16); // Conversion correcte en hexadécimal
        }
        const newFile = new FileEntity();
        newFile.type = getFileMimeType(header);
        newFile.name = name;
        newFile.content = data; // Assignation directe du Buffer
        newFile.size = data.length;
        return await this.fileRepository.save(newFile);
    }
}
