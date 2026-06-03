import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn, UpdateDateColumn, Index, DeleteDateColumn } from "typeorm";

/**
 * Stratégie de calcul pour la moyenne
 * - WEIGHTED: Moyenne pondérée par coefficients de catégories
 * - SIMPLE: Moyenne simple (toutes les notes se valent)
 */
export enum CalculationStrategy {
    WEIGHTED = "WEIGHTED",
    SIMPLE = "SIMPLE"
}

/**
 * Configuration de notation pour une école, classe ou matière
 * Hiérarchie de priorité: Matière > Classe > École (défaut)
 */
@Entity("grading_config")
@Index(["schoolId", "classId", "subjectId", "period"], { unique: true })
export class GradingConfigEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: 'integer' })
    schoolId: number;

    @Column({ type: 'integer', nullable: true })
    classId: number | null; // Null = Config par défaut pour toute l'école

    @Column({ type: 'integer', nullable: true })
    subjectId: number | null; // Null = Config pour toutes les matières de la classe

    @Column({ type: 'varchar', length: 100, nullable: true })
    period: string | null; // Null = Config pour toutes les périodes, ex: "Trimestre 1"

    @Column({ type: "float", default: 20 })
    finalGradeBase: number; // Base de la note finale (ex: 20, 10, 100)

    @Column({ 
        type: "varchar", 
        default: CalculationStrategy.WEIGHTED 
    })
    calculationStrategy: CalculationStrategy;

    @Column({ type: 'boolean', default: true })
    normalizeScores: boolean; // Convertir les notes sur une base commune avant calcul

    @Column({ type: 'varchar', nullable: true })
    description: string | null; // Description optionnelle de cette config

    // Cascade pour sauvegarder les catégories en même temps
    @OneToMany(() => EvaluationCategoryEntity, (category) => category.config, {
        cascade: true,
        eager: true,
        onDelete: 'CASCADE'
    })
    categories: EvaluationCategoryEntity[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

/**
 * Catégorie d'évaluation (Devoir, Composition, TP, etc.)
 */
@Entity("evaluation_category")
export class EvaluationCategoryEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: 'varchar', length: 100 })
    name: string; // "Devoir", "Composition", "TP"

    @Column({ type: 'varchar', length: 10, nullable: true })
    code: string | null; // "DEV", "COM", "TP"

    @Column({ type: "float", default: 1 })
    weight: number; // Coefficient de la catégorie dans le calcul

    @Column({ type: "float", default: 20 })
    defaultMaxScore: number; // Note maximale par défaut pour cette catégorie

    @Column({ type: 'integer', nullable: true })
    minEntries: number | null; // Nombre minimum d'évaluations attendues (optionnel)

    @Column({ type: 'integer', nullable: true })
    maxEntries: number | null; // Nombre maximum d'évaluations (optionnel)

    @Column({ type: 'varchar', length: 7, default: '#3498db' })
    color: string; // Couleur pour l'affichage UI

    @Column({ type: 'integer', default: 0 })
    displayOrder: number; // Ordre d'affichage dans l'interface

    @Column({ type: 'boolean', default: false })
    isExam: boolean; // True si c'est un examen (composition, etc.)

    @ManyToOne(() => GradingConfigEntity, (config) => config.categories, {
        onDelete: "CASCADE"
    })
    config: GradingConfigEntity;
}
