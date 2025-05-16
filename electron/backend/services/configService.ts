import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppDataSource } from '../../data-source';
import { SchoolEntity } from '../entities/school';
import { GradeEntity } from '../entities/grade';
import { ClassRoomEntity } from '../entities/grade';
import { CourseEntity } from '../entities/course';
import { PaymentConfigEntity } from '../entities/paymentConfig';
import { YearRepartitionEntity } from '../entities/yearRepartition';

export class ConfigService {
    private static instance: ConfigService;
    private configPath: string;
    private isFirstLaunch: boolean = false;

    private constructor() {
        console.log('Constructeur ConfigService appelé');
        this.configPath = path.join(app.getPath('userData'), 'config');
        console.log('Chemin de configuration:', this.configPath);
    }

    static getInstance(): ConfigService {
        console.log('getInstance ConfigService appelé');
        if (!ConfigService.instance) {
            console.log('Création d\'une nouvelle instance de ConfigService');
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    async initialize(): Promise<void> {
        try {
            console.log('Début de l\'initialisation du ConfigService');
            const dbPath = path.join(app.getPath('userData'), 'database.db');
            console.log('Chemin de la base de données:', dbPath);
            
            // Vérifier si le dossier de configuration existe
            const configDirExists = fs.existsSync(this.configPath);
            console.log('Le dossier de configuration existe:', configDirExists);
            
            // Vérifier si la base de données existe
            const dbExists = fs.existsSync(dbPath);
            console.log('La base de données existe:', dbExists);
            
            // C'est le premier lancement si la base de données n'existe pas
            this.isFirstLaunch = !dbExists;
            console.log('Est-ce le premier lancement:', this.isFirstLaunch);

            if (this.isFirstLaunch) {
                console.log('Initialisation de la configuration...');
                if (!configDirExists) {
                    console.log('Création du dossier de configuration:', this.configPath);
                    fs.mkdirSync(this.configPath, { recursive: true });
                }

                const defaultConfigsPath = path.join(process.resourcesPath, 'config');
                console.log('Chemin des configurations par défaut:', defaultConfigsPath);
                console.log('Le dossier de config existe:', fs.existsSync(defaultConfigsPath));

                if (fs.existsSync(defaultConfigsPath)) {
                    const files = fs.readdirSync(defaultConfigsPath);
                    console.log('Fichiers de configuration trouvés:', files);
                    for (const file of files) {
                        const sourcePath = path.join(defaultConfigsPath, file);
                        const targetPath = path.join(this.configPath, file);
                        console.log('Copie de', sourcePath, 'vers', targetPath);
                        fs.copyFileSync(sourcePath, targetPath);
                    }
                }
            }
            console.log('Initialisation du ConfigService terminée');
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la configuration:', error);
            throw error;
        }
    }

    async isFirstLaunchCheck(): Promise<boolean> {
        console.log('Vérification du premier lancement...');
        console.log('État actuel:', this.isFirstLaunch);
        return this.isFirstLaunch;
    }

    async setFirstLaunchComplete(): Promise<void> {
        console.log('Marquage du premier lancement comme terminé');
        this.isFirstLaunch = false;
        console.log('Nouveau statut de premier lancement:', this.isFirstLaunch);
    }

    async saveConfiguration(data: any): Promise<void> {
        try {
            const dataSource = await AppDataSource.initialize();
            
            if (data.school) {
                await dataSource.getRepository(SchoolEntity).save(data.school);
            }
            if (data.grades) {
                await dataSource.getRepository(GradeEntity).save(data.grades);
            }
            if (data.classrooms) {
                await dataSource.getRepository(ClassRoomEntity).save(data.classrooms);
            }
            if (data.courses) {
                await dataSource.getRepository(CourseEntity).save(data.courses);
            }
            if (data.paymentConfig) {
                await dataSource.getRepository(PaymentConfigEntity).save(data.paymentConfig);
            }
            if (data.yearRepartition) {
                await dataSource.getRepository(YearRepartitionEntity).save(data.yearRepartition);
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la configuration:', error);
            throw error;
        }
    }
}
