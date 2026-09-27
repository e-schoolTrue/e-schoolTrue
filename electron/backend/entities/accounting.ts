import {
    Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique, Index, Check
} from "typeorm";

/**
 * Comptabilité réelle : montants decimal(14,2), snapshot currency par écriture,
 * soft-delete + contre-écriture (jamais de DELETE physique côté service).
 * Devises : MAD (2 décimales), XOF/XAF/GNF (0) — voir utils/countryCurrency.
 */

// ---------------------------------------------------------------- Expense
@Entity("expenses")
@Index("IDX_expense_created_at", ["created_at"])
@Index("IDX_expense_schoolYear", ["schoolYear"])
@Check(`"status" IN ('pending','approved','cancelled')`)
export class ExpenseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "varchar", length: 255 })
    label!: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    category?: string;

    @Column("decimal", { precision: 14, scale: 2 })
    amount!: number;

    /** Snapshot devise à l'écriture (MAD/XOF/XAF/GNF). */
    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "date", nullable: true })
    expenseDate?: Date;

    @Column({ type: "varchar", length: 50, default: "cash" })
    paymentMethod!: string;

    @Column({ type: "varchar", length: 20, default: "pending" })
    status!: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    receiptNumber?: string;

    @Column({ type: "varchar", length: 64, nullable: true, unique: true })
    idempotencyKey?: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    @Index("IDX_expense_studentId", { synchronize: false })
    studentId?: string;

    @Column({ type: "varchar", nullable: true })
    schoolYear?: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// ------------------------------------------------------------ CashRegister
@Entity("cash_registers")
@Unique("UQ_cash_register_date_registre", ["name", "registerDate"])
@Check(`"status" IN ('open','closed')`)
export class CashRegisterEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    /** Nom du registre (caisse principale, caisse annexe...). */
    @Column({ type: "varchar", length: 100 })
    name!: string;

    /** Jour d'ouverture du registre (1 registre/jour). */
    @Column({ type: "date" })
    registerDate!: Date;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    openingBalance!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    closingBalance!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "varchar", length: 20, default: "open" })
    status!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// ------------------------------------------------------------ CashMovement (append-only)
@Entity("cash_movements")
@Index("IDX_cash_movement_created_at", ["created_at"])
@Index("IDX_cash_movement_schoolYear", ["schoolYear"])
@Check(`"direction" IN ('IN','OUT')`)
export class CashMovementEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @ManyToOne(() => CashRegisterEntity, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ name: "registerId" })
    register?: CashRegisterEntity;

    @Column({ type: "integer", nullable: true })
    registerId?: number;

    /** IN = encaissement, OUT = décaissement. */
    @Column({ type: "varchar", length: 10 })
    direction!: string;

    @Column("decimal", { precision: 14, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    motive?: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    reference?: string;

    @Column({ type: "varchar", length: 64, nullable: true, unique: true })
    idempotencyKey?: string;

    @Column({ type: "integer", nullable: true })
    paymentId?: number;

    @Column({ type: "integer", nullable: true })
    expenseId?: number;

    @Column({ type: "date", nullable: true })
    movementDate?: Date;

    @Column({ type: "varchar", nullable: true })
    schoolYear?: string;

    @CreateDateColumn()
    created_at!: Date;
}

// ------------------------------------------------------------- CashClosure
@Entity("cash_closures")
@Index("IDX_cash_closure_created_at", ["created_at"])
export class CashClosureEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @ManyToOne(() => CashRegisterEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "registerId" })
    register!: CashRegisterEntity;

    @Column({ type: "integer" })
    registerId!: number;

    @Column({ type: "date" })
    closureDate!: Date;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    expectedAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    countedAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    gap!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    validatedBy?: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;
}

// ------------------------------------------------------------- BankAccount
@Entity("bank_accounts")
export class BankAccountEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "varchar", length: 150 })
    bankName!: string;

    @Column({ type: "varchar", length: 64, unique: true })
    accountNumber!: string;

    @Column({ type: "varchar", length: 64, nullable: true })
    iban?: string;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    balance!: number;

    /** Devise du compte — défaut dynamique selon l'école (service), jamais GNF en dur côté métier. */
    @Column({ type: "varchar", length: 10, default: "GNF" })
    currency!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// --------------------------------------------------------- BankTransaction
@Entity("bank_transactions")
@Index("IDX_bank_tx_created_at", ["created_at"])
@Index("IDX_bank_tx_schoolYear", ["schoolYear"])
@Check(`"direction" IN ('IN','OUT')`)
export class BankTransactionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @ManyToOne(() => BankAccountEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "accountId" })
    account!: BankAccountEntity;

    @Column({ type: "integer" })
    accountId!: number;

    @Column({ type: "varchar", length: 10 })
    direction!: string;

    @Column("decimal", { precision: 14, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "varchar", length: 64, nullable: true, unique: true })
    idempotencyKey?: string;

    @Column({ type: "date", nullable: true })
    transactionDate?: Date;

    @Column({ type: "varchar", length: 64, nullable: true })
    reference?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    label?: string;

    @Column({ type: "varchar", nullable: true })
    schoolYear?: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// ---------------------------------------------------------- TeacherHourLog
@Entity("teacher_hour_logs")
@Index("IDX_hourlog_prof_month", ["professorId", "month"])
@Index("IDX_hourlog_created_at", ["created_at"])
export class TeacherHourLogEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "integer" })
    professorId!: number;

    /** Mois au format YYYY-MM. */
    @Column({ type: "varchar", length: 7 })
    month!: string;

    @Column("decimal", { precision: 7, scale: 2, default: 0 })
    hours!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    hourlyRate!: number;

    @Column({ type: "varchar", length: 100, nullable: true })
    subject?: string;

    @Column({ type: "integer", nullable: true })
    classId?: number;

    @Column({ type: "boolean", default: false })
    validated!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// -------------------------------------------------------------- SalarySlip
@Entity("salary_slips")
@Unique("UQ_salary_slip_prof_month", ["professorId", "month"])
@Index("IDX_salaryslip_created_at", ["created_at"])
@Check(`"status" IN ('brouillon','valide','paye','pending','approved','cancelled')`)
export class SalarySlipEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "integer" })
    professorId!: number;

    @Column({ type: "varchar", length: 7 })
    month!: string;

    @Column("decimal", { precision: 7, scale: 2, default: 0 })
    hoursTotal!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    hourlyRate!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    grossAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    netAmount!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column("simple-json", { nullable: true })
    deductions?: Array<{ name: string; amount: number; description?: string }>;

    @Column("simple-json", { nullable: true })
    additions?: Array<{ name: string; amount: number; description?: string }>;

    @Column({ type: "varchar", length: 20, default: "brouillon" })
    status!: string;

    @Column({ type: "integer", nullable: true })
    paymentId?: number;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}

// ----------------------------------------------------------- ReceiptCounter (élèves R-YYYY-NNNN)
@Entity("receipt_counters")
export class ReceiptCounterEntity {
    /** Année civile (ex. 2026). Clé primaire naturelle. */
    @PrimaryColumn({ type: "integer" })
    year!: number;

    @Column({ type: "integer", default: 0 })
    lastNumber!: number;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;
}

// -------------------------------------- ProfessorPaymentCounter (PAY-ENS-YYYY-XXXX)
@Entity("professor_payment_counters")
export class ProfessorPaymentCounterEntity {
    /** Année civile. Clé primaire naturelle, séquence sans trou. */
    @PrimaryColumn({ type: "integer" })
    year!: number;

    @Column({ type: "integer", default: 0 })
    lastNumber!: number;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;
}

// ----------------------------------------------------------------- FeeItem
@Entity("fee_items")
@Index("IDX_feeitem_created_at", ["created_at"])
@Index("IDX_feeitem_schoolYear", ["schoolYear"])
export class FeeItemEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "varchar", length: 150 })
    name!: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    category?: string;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    amount!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "integer", nullable: true })
    gradeId?: number;

    @Column({ type: "varchar", nullable: true })
    schoolYear?: string;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn({ nullable: true })
    updated_at?: Date;

    @DeleteDateColumn({ nullable: true })
    deleted_at?: Date;
}
