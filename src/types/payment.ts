export interface PaymentConfig {
  allowScholarship: boolean;
  scholarshipPercentages: number[];
  annualAmount: number;
  classId: string | number;
  className?: string;
  installments: number;
}

export interface PaymentData {
  studentId: number;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  reference?: string;
  comment?: string;
  installmentNumber: number;
  schoolYear: string;
  scholarshipPercentage: number | null;
  adjustedAmount: number;
  baseAmount: number;
} 