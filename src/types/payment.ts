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
  inscriptionFee: number;
  reInscriptionFee: number;
  allowScholarship: boolean;
  scholarshipPercentages?: number[];
  scholarshipCriteria?: string;
}

export interface PaymentConfigCreateInput {
  classId: string;
  annualAmount: number;
  inscriptionFee: number;
  reInscriptionFee: number;
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

export interface StudentPaymentData {
  payments: IPaymentData[];
  baseAmount: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
}

export interface PaymentAmounts {
  paid: number;
  remaining: number;
  studentId: number;
  baseAmount: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
}

export interface TranchConfig {
  id: string;
}

export interface PaymentScheduleConfig {
  id?: number;
  gradeId: number;
  paymentMode: 'monthly' | 'installments' | 'custom';
  schedules: PaymentSchedule[];
  totalAmount: number;
  isActive: boolean;
  schoolYear?: string;
}

export interface PaymentSchedule {
  id?: number;
  name: string;
  amount: number;
  dueDate: Date;
  order: number;
  isRecurring?: boolean;
  description?: string;
}

export interface CustomPaymentConfig {
  id?: number;
  gradeId: number;
  name: string;
  paymentType: 'monthly' | 'installments' | 'custom';
  
  // Pour les mensualités
  monthlyConfig?: {
    numberOfMonths: number;
    startMonth: number; // 1-12
    monthlyAmount: number;
    excludedMonths?: number[]; // Mois exclus (vacances, etc.)
  };
  
  // Pour les tranches
  installmentConfig?: {
    numberOfInstallments: number;
    installments: {
      name: string;
      percentage: number;
      dueMonth: number;
      amount?: number;
    }[];
  };
  
  // Pour configuration personnalisée
  customSchedule?: {
    schedules: PaymentSchedule[];
  };
  
  totalAnnualAmount: number;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPaymentAnnualConfig{
  id?: number;
  trancheCount?: number;
  gradeId?:number
  tranches?:ITranchConfig[]
}

export interface ITranchConfig {
  id?: number;
  tranchName?: string;
  tranchMonthCount?: number;
  entries?:ITrancheEntry[]
}

export interface ITrancheEntry {
  id?: number;
  startDate?: Date;
  endDate?: Date;
}


