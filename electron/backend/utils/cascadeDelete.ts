// casacadeDelete.ts
import { DataSource, EntityManager } from 'typeorm';
import { AppDataSource } from '#electron/data-source';

export interface CascadeDeleteOptions {
    entityName: string; // Devrait être le nom de la classe Entité (ex: "GradeEntity") ou la classe elle-même
    id: number;
    relations: {
        tableName: string;      // Nom de la table en BDD
        foreignKey: string;     // Nom de la colonne clé étrangère en BDD
        cascade?: boolean;
    }[];
}

export class CascadeDelete {
    private static instance: CascadeDelete;
    private dataSource: DataSource;

    private constructor() {
        this.dataSource = AppDataSource.getInstance();
    }

    private getTableDisplayName(tableName: string): string {
        const tableNames: { [key: string]: string } = {
            'T_student': 'étudiant(s)',
            'absences': 'absence(s)',
            'teaching_assignment': 'affectation(s) d\'enseignement',
            'payments': 'paiement(s)',
            'homework': 'devoir(s)',
            'class_room': 'salle(s) de classe',
            'branch': 'filière(s)',
            'grade_config': 'configuration(s)',
            'scholarships': 'bourse(s)',
            'T_report_card': 'bulletin(s)',
            'teaching_grades': 'niveau(x) d\'enseignement'
        };

        return tableNames[tableName] || tableName;
    }

    public static getInstance(): CascadeDelete {
        if (!CascadeDelete.instance) {
            CascadeDelete.instance = new CascadeDelete();
        }
        return CascadeDelete.instance;
    }

    async delete(options: CascadeDeleteOptions): Promise<{ success: boolean; message: string }> {
        try {
            return await this.dataSource.transaction(async (manager: EntityManager) => {
                // Vérifier si l'entité existe
                // Assurez-vous que options.entityName est le nom de la classe d'entité (ex: "GradeEntity")
                // ou la classe d'entité elle-même (ex: GradeEntity)
                // Si c'est un nom de table (ex: "grade"), cela peut fonctionner pour findOne/delete
                // si la table est unique et bien mappée, mais c'est plus sûr d'utiliser le nom de l'entité.
                // D'après vos logs, "GradeEntity" semble être utilisé, ce qui est bien.
                const entity = await manager.findOne(options.entityName, {
                    where: { id: options.id } as any // 'as any' pour éviter les pbs de typage si entityName est une string
                });

                if (!entity) {
                    return {
                        success: false,
                        message: `${options.entityName} non trouvé`
                    };
                }

                // Supprimer les relations
                for (const relation of options.relations) {
                    if (relation.cascade) {
                        // Supprimer en cascade en utilisant le nom de la colonne et de la table
                        const queryBuilder = manager.createQueryBuilder()
                            .delete()
                            .from(relation.tableName) // tableName est le nom de la table BDD
                            .where(`"${relation.foreignKey}" = :id`, { id: options.id }); // foreignKey est le nom de la colonne BDD
                                                                                        // Les guillemets protègent les noms de colonnes (utile pour Postgres par ex.)
                        await queryBuilder.execute();
                    } else {
                        // Vérifier s'il y a des relations en utilisant QueryBuilder
                        // relation.tableName est le nom de la table BDD
                        // relation.foreignKey est le nom de la colonne BDD
                        const countQuery = manager.createQueryBuilder()
                            .select("COUNT(*)", "count")
                            .from(relation.tableName, "alias_for_related_table") // L'alias est nécessaire pour la syntaxe
                            .where(`alias_for_related_table."${relation.foreignKey}" = :id`, { id: options.id });
                        
                        // Pour déboguer la requête SQL générée :
                        // console.log("Count query:", countQuery.getQueryAndParameters());

                        const result = await countQuery.getRawOne();
                        const count = result ? parseInt(result.count, 10) : 0;

                        if (count > 0) {
                            const displayName = this.getTableDisplayName(relation.tableName);
                            return {
                                success: false,
                                message: `Impossible de supprimer car il y a ${count} ${displayName} lié(s)`
                            };
                        }
                    }
                }

                // Supprimer l'entité principale
                await manager.delete(options.entityName, { id: options.id } as any);

                return {
                    success: true,
                    message: `${options.entityName} supprimé avec succès`
                };
            });
        } catch (error) {
            console.error(`Erreur lors de la suppression de ${options.entityName}:`, error);
            return {
                success: false,
                message: `Erreur lors de la suppression: ${error.message}` // error.message contient déjà l'info pertinente
            };
        }
    }
}