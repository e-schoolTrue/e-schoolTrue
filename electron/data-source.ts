import {DataSource} from "typeorm";
import {UserEntity} from "./backend/entities/user";
import {StudentEntity} from "./backend/entities/students.ts";
import {FileEntity} from "./backend/entities/file.ts";
import {ProfessorEntity, QualificationEntity,DiplomaEntity} from  "./backend/entities/professor.ts";
import {AbsenceEntity} from "./backend/entities/absence.ts";
import {PaymentEntity} from "./backend/entities/payment.ts";
import {PaymentConfigEntity} from "./backend/entities/paymentConfig.ts";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {app} from "electron";
import {CourseEntity, ObservationEntity} from "#electron/backend/entities/course.ts";
import { SchoolEntity } from "./backend/entities/school.ts";
import {YearRepartitionEntity} from "#electron/backend/entities/yearRepartition";
import { ReportCardEntity } from "./backend/entities/report";
import path from 'path';
import { TeachingAssignmentEntity } from "./backend/entities/teaching";
import { ProfessorPaymentEntity } from "./backend/entities/professorPayment";
import { HomeworkEntity } from "./backend/entities/homework";
import { VacationEntity } from "./backend/entities/vacation";
import { ScholarshipEntity } from "./backend/entities/scholarship";
import { PreferenceEntity } from "./backend/entities/preference";
import { GradeConfigEntity } from "./backend/entities/gradeConfig";



export class AppDataSource {
    private static instance: DataSource;
    private constructor() {}
    
    static getInstance(): DataSource {
        if (!AppDataSource.instance) {
            const dbPath = path.join(app.getPath('userData'), 'database.db');
            const isProd = process.env.NODE_ENV === 'production';
            
            console.log('Mode de l\'application:', isProd ? 'Production' : 'Développement');
            console.log('Chemin de la base de données:', dbPath);
            
            AppDataSource.instance = new DataSource({
                type: "better-sqlite3",
                database: dbPath,
                // Configuration différente selon l'environnement
                synchronize: !isProd,      // Désactivé en production
                dropSchema: false,         // Ne jamais supprimer le schéma
                logging: !isProd,          // Logs uniquement en développement
                entities: [
                    UserEntity, FileEntity, StudentEntity, GradeEntity,
                    ClassRoomEntity, BranchEntity, CourseEntity,
                    ObservationEntity, AbsenceEntity, PaymentEntity,
                    PaymentConfigEntity, SchoolEntity, YearRepartitionEntity,
                    ProfessorEntity, QualificationEntity, DiplomaEntity,
                    TeachingAssignmentEntity, ProfessorPaymentEntity,
                    HomeworkEntity, VacationEntity, ReportCardEntity,
                    ScholarshipEntity, PreferenceEntity, GradeConfigEntity
                ],
                subscribers: [],
                migrations: [], // À configurer plus tard si nécessaire
                migrationsRun: false // Désactivé pour l'instant
            });
        }
        return AppDataSource.instance;
    }

    static async initialize(): Promise<DataSource> {
        const instance = AppDataSource.getInstance();
        if (!instance.isInitialized) {
            try {
                await instance.initialize();
                
                // Vérification de l'état de la base de données
                const isProd = process.env.NODE_ENV === 'production';
                if (isProd) {
                    console.log("Mode production : synchronisation automatique désactivée");
                } else {
                    console.log("Mode développement : synchronisation automatique activée");
                }
                
                console.log("Base de données initialisée avec succès");
                
                // Vérification de la connexion
                const isConnected = instance.isInitialized;
                console.log("État de la connexion:", isConnected ? "Connecté" : "Non connecté");
                
            } catch (error) {
                console.error("Erreur lors de l'initialisation de la base de données:", error);
                throw error;
            }
        }
        return instance;
    }
}

