export interface IPaymentData {
    id?: number;
    amount: number;
    paymentType: string;
    paymentMethod: string;
    created_at?: Date;
    studentId: number;
    installmentNumber?: number;
    schoolYear?: string;
    comment?: string;
    scholarshipId?: number;
    baseAmount?: number;
    scholarshipAmount?: number;
    adjustedAmount?: number;
    scholarshipPercentage?: number;
}

export interface IPaymentConfigData {
    id?: number;
    classId: string;
    annualAmount: number;
    allowScholarship: boolean;
    scholarshipPercentages: number[];
    scholarshipCriteria: string;
}

export interface IProfessorPaymentData {
    id?: number;
    professorId: number;
    amount: number;
    type: string;
    paymentMethod: string;
    month: string;
    reference?: string;
    comment?: string;
    isPaid: boolean;
    grossAmount?: number;
    netAmount?: number;
    deductions?: any[];
    additions?: any[];
}

export interface IScholarshipData {
    id?: number;
    studentId: number;
    percentage: number;
    reason?: string;
    schoolYear: string;
    isActive: boolean;
}

export interface IPaymentServiceParams {
    saveConfig: {
        classId: string;
        annualAmount: number;
        allowScholarship: boolean;
        scholarshipPercentages: number[];
        scholarshipCriteria: string;
    };
    addPayment: {
        studentId: number;
        amount: number;
        paymentType: string;
        paymentMethod: string;
        installmentNumber?: number;
        schoolYear?: string;
        comment?: string;
        scholarshipPercentage?: number;
        scholarshipAmount?: number;
        adjustedAmount?: number;
        baseAmount?: number;
    };
    addProfessorPayment: {
        professorId: number;
        amount: number;
        type: string;
        paymentMethod: string;
        month: string;
        reference?: string;
        comment?: string;
        grossAmount?: number;
        netAmount?: number;
        deductions?: any[];
        additions?: any[];
    };
    updateProfessorPayment: {
        id: number;
        isPaid?: boolean;
        amount?: number;
        type?: string;
        paymentMethod?: string;
        month?: string;
        reference?: string;
        comment?: string;
        grossAmount?: number;
        netAmount?: number;
        deductions?: any[];
        additions?: any[];
    };
    assignScholarship: {
        studentId: number;
        configId: number;
        percentage: number;
        reason?: string;
    };
}

export interface IPaymentServiceResponse {
    success: boolean;
    data: IPaymentData | IPaymentConfigData | IProfessorPaymentData | IScholarshipData | any | null;
    message: string;
    error: string | null;
}

export interface PaymentConfig {
  classId: string;
  className: string;
  annualAmount: number;
  allowScholarship: boolean;
  scholarshipPercentages?: number[];
  scholarshipCriteria?: string;
}

export interface PaymentConfigCreateInput {
  classId: string;
  annualAmount: number;
  allowScholarship: boolean;
  scholarshipPercentages?: number[];
  scholarshipCriteria?: string;
}

export interface PaymentConfigUpdateInput extends PaymentConfigCreateInput {
  id: string;
}

export interface PaymentConfigResponse {
  success: boolean;
  data: PaymentConfig | null;
  message: string;
  error: string | null;
}

// Nouvelle interface pour représenter les données de paiement d'un étudiant
export interface StudentPaymentData {
  payments: IPaymentData[];
  baseAmount: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
}

// Interface pour le stockage local des montants de paiement
export interface PaymentAmounts {
  paid: number;
  remaining: number;
  studentId: number;
  baseAmount: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
}
