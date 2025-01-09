<template>
  <el-container class="payment-management">
    <el-header class="payment-header">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="stat-card success" shadow="hover">
            <template #header>
              <div class="stat-header">
                <el-icon><Money /></el-icon>
                <span>Montant Collecté</span>
              </div>
            </template>
            <div class="stat-content">
              <currency-display :amount="getTotalCollectedAmount()" />
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="stat-card warning" shadow="hover">
            <template #header>
              <div class="stat-header">
                <el-icon><Wallet /></el-icon>
                <span>Reste à Collecter</span>
              </div>
            </template>
            <div class="stat-content">
              <currency-display :amount="getTotalRemainingAmount()" />
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="stat-card info" shadow="hover">
            <template #header>
              <div class="stat-header">
                <el-icon><Discount /></el-icon>
                <span>Réductions Bourses</span>
              </div>
            </template>
            <div class="stat-content">
              <currency-display :amount="getTotalScholarshipAmount()" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-header>

    <el-main class="payment-content">
      <el-card class="payment-table-card" shadow="hover">
        <template #header>
          <div class="table-header">
            <div class="search-filters">
              <el-input
                v-model="filters.studentFullName"
                placeholder="Rechercher un étudiant..."
                prefix-icon="Search"
                clearable
                @input="handleFilter"
              />
              
              <el-select 
                v-model="filters.grade" 
                placeholder="Classe"
                clearable
                @change="handleFilter"
              >
                <el-option
                  v-for="grade in grades"
                  :key="grade.id"
                  :label="grade.name"
                  :value="grade.id"
                />
              </el-select>

              <el-select 
                v-model="filters.paymentStatus" 
                placeholder="Statut de paiement"
                clearable
                @change="handleFilter"
              >
                <el-option label="Payé" value="paid" />
                <el-option label="En retard" value="late" />
                <el-option label="Non payé" value="unpaid" />
              </el-select>
            </div>

            <div class="table-actions">
              <el-button-group>
                <el-button
                  type="success"
                  :icon="Download"
                  @click="exportToExcel"
                  :loading="loading"
                >
                  Exporter Excel
                </el-button>
                <el-button
                  type="primary"
                  :icon="Refresh"
                  @click="refreshData"
                  :loading="loading"
                >
                  Actualiser
                </el-button>
              </el-button-group>
            </div>
          </div>
        </template>

        <!-- Table des paiements améliorée -->
        <el-table
          v-loading="loading"
          :data="filteredStudents"
          border
          stripe
          :height="tableHeight"
          highlight-current-row
        >
          <el-table-column type="expand">
            <template #default="props">
              <payment-history-mini :student="props.row" />
            </template>
          </el-table-column>

          <el-table-column 
            label="Élève" 
            min-width="200"
            sortable
          >
            <template #default="{ row }">
              <div class="student-info">
                <el-avatar :size="32" :src="row.photo?.path">
                  {{ getInitials(row) }}
                </el-avatar>
                <div class="student-details">
                  <span class="student-name">{{ row.firstname }} {{ row.lastname }}</span>
                  <small class="student-matricule">{{ row.matricule }}</small>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column 
            label="Bourse" 
            width="150"
            align="center"
          >
            <template #default="{ row }">
              <template v-if="getActiveScholarship(row)">
                <el-tooltip
                  effect="dark"
                  placement="top"
                >
                  <template #content>
                    <div>
                      <currency-display :amount="getAnnualAmount(row.grade?.id)" />
                          <p>Montant initial: <currency-display :amount="getAnnualAmount(row.grade?.id)" /></p>
                          <p>Réduction: {{ getActiveScholarship(row)?.percentage }}%</p>
                      <p>Économie: <currency-display :amount="getScholarshipAmount(row)" /></p>
                    </div>
                  </template>
                <el-tag type="success" effect="dark" size="small">
                  {{ getActiveScholarship(row)?.percentage }}%
                </el-tag>
                </el-tooltip>
                <div class="scholarship-amount">
                  -<currency-display :amount="getScholarshipAmount(row)" />
                </div>
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>

          <el-table-column 
            label="Progression" 
            width="200"
            sortable
          >
            <template #default="{ row }">
              <div class="payment-progress">
                <el-progress
                  :percentage="getPaymentProgress(row.id)"
                  :status="getProgressStatus(row.id)"
                  :format="(val: number) => `${val}%`"
                  :stroke-width="10"
                />
                <small class="progress-details">
                  <currency-display :amount="getPaidAmount(row.id)" /> / 
                  <currency-display :amount="getStudentAdjustedAmount(row)" />
                </small>
              </div>
            </template>
          </el-table-column>

          <el-table-column 
            label="Statut" 
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                :type="getPaymentStatusType(row.id)"
                effect="dark"
                size="small"
              >
                {{ getPaymentStatusLabel(row.id) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column 
            label="Actions" 
            width="200" 
            fixed="right"
            align="center"
          >
            <template #default="{ row }">
              <el-button-group>
                <el-button
                  type="primary"
                  size="small"
                  @click="showPaymentHistory(row)"
                >
                  <el-icon><Document /></el-icon>
                </el-button>
                <el-button
                  type="success"
                  size="small"
                  @click="printReceipt(row)"
                >
                  <el-icon><Printer /></el-icon>
                </el-button>
                <el-button
                  type="warning"
                  size="small"
                  @click="showNewPaymentDialog(row)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>

        <!-- Pagination -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="totalStudents"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            background
          />
        </div>
      </el-card>
    </el-main>

    <!-- Dialogs -->
    <payment-dialog
      v-model:visible="paymentDialogVisible"
      :student="selectedStudent"
      :config="getConfigForStudent(selectedStudent)"
      @payment-added="handlePaymentAdded"
    />

    <payment-history-dialog
      v-model:visible="historyDialogVisible"
      :student="selectedStudent"
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Document, Download, Refresh, Printer, Discount } from "@element-plus/icons-vue";
import PaymentDialog from '@/components/payment/PaymentDialog.vue';
import PaymentHistoryDialog from '@/components/payment/PaymentHistory.vue';
import printJS from 'print-js';
import * as XLSX from 'xlsx';
import { PaymentConfig } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  grade?: {
    id: number;
    name: string;
  };
  absences?: Array<{
    id: number;
    date: Date;
    reason: string;
    justified: boolean;
  }>;
  payments?: Array<{
    id: number;
    amount: number;
    createdAt: Date;
    paymentType: string;
  }>;
  scholarshipPercentage?: number;
  scholarship?: Array<{
    id: number;
    percentage: number;
    isActive: boolean;
    schoolYear: string;
  }>;
}

interface Grade {
  id: number;
  name: string;
}

interface PaymentAmounts {
  paid: number;
  remaining: number;
  studentId: number;
  baseAmount: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
}

interface Filters {
  studentFullName: string;
  grade?: number;
  paymentStatus?: 'paid' | 'late' | 'unpaid';
}

const filteredStudents = ref<Student[]>([]);
const grades = ref<Grade[]>([]);
const tableHeight = "calc(100vh - 350px)";

const students = ref<Student[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(5);
const totalStudents = ref(0);
const paymentDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const selectedStudent = ref<Student>(null as unknown as Student);
const classConfigs = ref(new Map<number, PaymentConfig>());
const paymentAmounts = ref(new Map<number, PaymentAmounts>());
const filters = ref<Filters>({
  studentFullName: "",
  grade: undefined,
  paymentStatus: undefined
});

const loadPaymentConfigs = async () => {
  try {
    console.log("Chargement des configurations de paiement...");
    const result = await window.ipcRenderer.invoke("payment:getConfigs");
    console.log("Résultat des configurations:", result);

    if (result?.success && Array.isArray(result.data)) {
      // Créer une nouvelle Map avec les configurations
      const newConfigs = new Map<number, PaymentConfig>();
      
      result.data.forEach((config: PaymentConfig) => {
        // Assurez-vous que classId est un nombre
        const classId = Number(config.classId);
        if (!isNaN(classId)) {
          newConfigs.set(classId, {
            ...config,
            classId: classId,
            annualAmount: Number(config.annualAmount),
            installments: Number(config.installments)
          });
        }
      });

      classConfigs.value = newConfigs;
      console.log("Configurations chargées:", Array.from(classConfigs.value.entries()));

      if (students.value.length > 0) {
        await loadStudentAmounts();
      }
    } else {
      console.warn("Aucune configuration trouvée ou format invalide:", result);
      ElMessage.warning("Aucune configuration de paiement trouvée. Veuillez configurer les paiements d'abord.");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des configurations:", error);
    ElMessage.error("Erreur lors du chargement des configurations de paiement");
  }
};

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result?.success && Array.isArray(result.data)) {
      grades.value = result.data;
    } else {
      console.error("Format de données invalide pour les niveaux scolaires");
      ElMessage.error("Erreur lors du chargement des niveaux scolaires");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des niveaux scolaires:", error);
    ElMessage.error("Erreur lors du chargement des niveaux scolaires");
  }
};


const getAnnualAmount = (gradeId: number | undefined): number => {
  if (!gradeId) return 0;
  const config = classConfigs.value.get(gradeId);
  return config?.annualAmount || 0;
};

const getPaidAmount = (studentId: number): number => {
  const amounts = paymentAmounts.value.get(studentId);
  return amounts?.paid || 0;
};

const getConfigForStudent = (student: Student | null): PaymentConfig | null => {
  if (!student?.grade?.id) {
    console.log('Pas de grade pour l\'étudiant');
    return null;
  }

  const config = classConfigs.value.get(student.grade.id);
  console.log('Configuration trouvée pour l\'étudiant:', config);
  return config || null;
};

const loadStudents = async () => {
  try {
    loading.value = true;
    const result = await window.ipcRenderer.invoke('student:all');
    
    if (result.success) {
      const studentsWithData = await Promise.all(
        result.data.map(async (student: Student) => {
          // Charger les bourses
          const scholarshipResult = await window.ipcRenderer.invoke(
            'scholarship:getByStudent', 
            student.id
          );

          console.log(`=== Données pour l'étudiant ${student.firstname} ===`);
          console.log('Bourses:', scholarshipResult);

          // Charger les paiements
          const paymentsResult = await window.ipcRenderer.invoke(
            'payment:getByStudent',
            student.id
          );

          if (paymentsResult.success) {
            const { baseAmount, scholarshipPercentage, scholarshipAmount, adjustedAmount, payments } = paymentsResult.data;
            const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

            paymentAmounts.value.set(student.id, {
              paid: totalPaid,
              remaining: adjustedAmount - totalPaid,
              studentId: student.id,
              baseAmount,
              scholarshipPercentage,
              scholarshipAmount,
              adjustedAmount
            });
          }

          return {
            ...student,
            scholarship: scholarshipResult.success ? scholarshipResult.data : []
          };
        })
      );

      students.value = studentsWithData;
      handleFilter();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des étudiants:', error);
    ElMessage.error('Erreur lors du chargement des étudiants');
  } finally {
    loading.value = false;
  }
};

const handleCurrentChange = async (page: number) => {
  currentPage.value = page;
  await loadStudents();
};

const handleSizeChange = async (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  await loadStudents();
};

const handleFilter = () => {
  if (!students.value) return;

  filteredStudents.value = students.value.filter(student => {
    // Filtre par nom/prénom
    const fullName = `${student.firstname} ${student.lastname}`.toLowerCase();
    const searchName = filters.value.studentFullName.toLowerCase();
    const nameMatch = !searchName || fullName.includes(searchName);

    // Filtre par classe
    const gradeMatch = !filters.value.grade || student.grade?.id === filters.value.grade;

    // Filtre par statut de paiement
    let statusMatch = true;
    if (filters.value.paymentStatus) {
      const status = getPaymentStatus(student.id);
      statusMatch = status === filters.value.paymentStatus;
    }

    return nameMatch && gradeMatch && statusMatch;
  });

  // Mettre à jour le total
  totalStudents.value = filteredStudents.value.length;
};

const showNewPaymentDialog = (student: Student) => {
  console.log("Ouverture du dialogue de paiement pour l'étudiant:", student);
  
  if (!verifyPaymentConfigs()) return;
  if (!student) return;
  if (!student.grade) {
    ElMessage.error("L'étudiant n'a pas de classe assignée");
    return;
  }

  const configData = getConfigForStudent(student);
  if (!configData) {
    ElMessage.warning(
      `Aucune configuration de paiement trouvée pour la classe ${student.grade.name}. Veuillez d'abord configurer les paiements.`
    );
    return;
  }

  selectedStudent.value = student;
  paymentDialogVisible.value = true;
};

const showPaymentHistory = (student: Student) => {
  selectedStudent.value = student;
  historyDialogVisible.value = true;
};

const handlePaymentAdded = async () => {
  loading.value = true;
  try {
    await loadStudents();
    // Recharger les paiements pour l'étudiant concerné
    if (selectedStudent.value?.id) {
      await loadStudentPayments(selectedStudent.value.id);
    }
    // Mettre à jour les montants pour tous les étudiants
    for (const student of students.value) {
      await loadStudentPayments(student.id);
    }
    ElMessage.success('Paiement enregistré avec succès');
  } catch (error) {
    console.error('Erreur lors du rechargement:', error);
  } finally {
    loading.value = false;
  }
};

const exportToExcel = async () => {
  try {
    loading.value = true;

    // Préparer les données pour l'export
    const exportData = await Promise.all(
      filteredStudents.value.map(async (student) => {
        const paidAmount = getPaidAmount(student.id);
        const annualAmount = getAnnualAmount(student.grade?.id);
        const progress = getPaymentProgress(student.id);
        const status = getPaymentStatusLabel(student.id);

        return {
          'Matricule': student.matricule,
          'Nom': student.lastname,
          'Prénom': student.firstname,
          'Classe': student.grade?.name || 'N/A',
          'Montant annuel': annualAmount,
          'Montant payé': paidAmount,
          'Reste à payer': Math.max(0, annualAmount - paidAmount),
          'Progression': `${progress}%`,
          'Statut': status
        };
      })
    );

    // Créer un workbook et une worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajuster la largeur des colonnes
    const colWidths = [
      { wch: 15 }, // Matricule
      { wch: 20 }, // Nom
      { wch: 20 }, // Prénom
      { wch: 15 }, // Classe
      { wch: 15 }, // Montant annuel
      { wch: 15 }, // Montant payé
      { wch: 15 }, // Reste à payer
      { wch: 12 }, // Progression
      { wch: 12 }  // Statut
    ];
    ws['!cols'] = colWidths;

    // Ajouter la worksheet au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');

    // Générer le nom du fichier
    const fileName = `paiements_etudiants_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Sauvegarder le fichier
    XLSX.writeFile(wb, fileName);

    ElMessage.success('Export Excel réussi');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    ElMessage.error('Erreur lors de l\'export Excel');
  } finally {
    loading.value = false;
  }
};

const refreshData = async () => {
  await loadStudentAmounts();
  await loadStudents();
  handleFilter();
};

const loadStudentAmounts = async () => {
  try {
    for (const student of students.value) {
      const [paidResult, configResult] = await Promise.all([
        window.ipcRenderer.invoke("payment:getByStudent", student.id),
        window.ipcRenderer.invoke("payment:getConfig", student.grade?.id)
      ]);

      if (paidResult?.success && configResult?.success) {
        const paidAmount = Array.isArray(paidResult.data)
          ? paidResult.data.reduce(
              (sum: number, payment: any) => sum + Number(payment.amount || 0),
              0
            )
          : 0;

        const annualAmount = configResult.data?.annualAmount || 0;

        paymentAmounts.value.set(student.id, {
          paid: paidAmount,
          remaining: Math.max(0, annualAmount - paidAmount),
          studentId: student.id,
          baseAmount: annualAmount,
          scholarshipPercentage: student.scholarshipPercentage || 0,
          scholarshipAmount: 0,
          adjustedAmount: 0
        });
      }
    }
    
    console.log('Montants mis à jour:', Array.from(paymentAmounts.value.entries()));
  } catch (error) {
    console.error("Erreur lors du chargement des montants:", error);
    ElMessage.error("Erreur lors du chargement des montants de paiement");
  }
};

const getPaymentProgress = (studentId: number) => {
  const student = students.value.find(s => s.id === studentId);
  if (!student) return 0;
  
  const total = getStudentAdjustedAmount(student);
  const paid = paymentAmounts.value.get(studentId)?.paid || 0;
  
  if (total === 0) return 0;
  return Math.round((paid / total) * 100);
};

const getProgressStatus = (studentId: number) => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return "success";
  if (progress >= 50) return "warning";
  return "exception";
};

const getTotalCollectedAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce(
    (sum, amounts) => sum + amounts.paid,
    0
  );
};

const getTotalRemainingAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce((sum, amounts) => {
    const adjustedAmount = amounts.adjustedAmount || amounts.baseAmount;
    const paidAmount = amounts.paid;
    return sum + Math.max(0, adjustedAmount - paidAmount);
  }, 0);
};

const verifyPaymentConfigs = () => {
  if (classConfigs.value.size === 0) {
    ElMessage.warning({
      message: "Aucune configuration de paiement n'est définie. Veuillez configurer les paiements dans le menu Configuration.",
      duration: 5000,
      showClose: true
    });
    return false;
  }
  return true;
};

watch(() => students.value, async (newStudents) => {
  if (newStudents.length > 0 && classConfigs.value.size === 0) {
    await loadPaymentConfigs();
  }
}, { deep: true });

watch(
  () => filters.value,
  () => {
    handleFilter();
  },
  { deep: true }
);

onMounted(async () => {
  loading.value = true;
  try {
    await loadPaymentConfigs(); // Charger d'abord les configurations
    await loadGrades();
    await loadStudents();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    ElMessage.error("Erreur lors de l'initialisation des données");
  } finally {
    loading.value = false;
  }
});

const getInitials = (student: Student): string => {
  return `${student.firstname[0]}${student.lastname[0]}`.toUpperCase();
};

const getPaymentStatusType = (studentId: number) => {
  const status = getPaymentStatus(studentId);
  const types = {
    paid: 'success',
    partial: 'warning',
    unpaid: 'danger'
  };
  return types[status] || 'info';
};

const getPaymentStatusLabel = (studentId: number) => {
  const status = getPaymentStatus(studentId);
  const labels = {
    paid: 'Payé',
    partial: 'Partiel',
    unpaid: 'Non payé'
  };
  return labels[status] || status;
};

const getPaymentStatus = (studentId: number) => {
  const student = students.value.find(s => s.id === studentId);
  if (!student?.grade?.id) return 'unpaid';

  const adjustedAmount = getAdjustedAnnualAmount(studentId);
  const paidAmount = getPaidAmount(studentId);
  
  if (paidAmount >= adjustedAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
};

const printReceipt = async (student: Student) => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getByStudent', student.id);
    console.log('Résultat pour impression:', result);

    if (!result.success || !result.data?.payments || result.data.payments.length === 0) {
      ElMessage.warning('Aucun paiement trouvé pour cet étudiant');
      return;
    }

    const lastPayment = result.data.payments[result.data.payments.length - 1];
    const schoolInfo = await window.ipcRenderer.invoke('school:get');
    if (!schoolInfo?.success) {
      throw new Error('Impossible de récupérer les informations de l\'école');
    }

    const studentName = `${student.firstname} ${student.lastname}`;
    const { currency } = useCurrency();

    const content = `
      <div class="receipt-container" style="padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${schoolInfo?.data?.logo ? `<img src="data:${schoolInfo.data.logo.type};base64,${schoolInfo.data.logo.content}" style="max-height: 100px; margin-bottom: 10px;">` : ''}
          <h2>${schoolInfo?.data?.name || 'École'}</h2>
          <h3>Reçu de Paiement N°${lastPayment.id}</h3>
          <p style="margin: 5px 0;">Date: ${formatDate(lastPayment.createdAt)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px;"><strong>Élève:</strong></td>
              <td style="padding: 5px;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Matricule:</strong></td>
              <td style="padding: 5px;">${student.matricule}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Classe:</strong></td>
              <td style="padding: 5px;">${student.grade?.name || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px;"><strong>Type de paiement:</strong></td>
              <td style="padding: 5px;">${formatPaymentType(lastPayment.paymentType)}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Montant:</strong></td>
              <td style="padding: 5px;">${new Intl.NumberFormat('fr-FR').format(lastPayment.amount)} ${currency.value}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Mode de paiement:</strong></td>
              <td style="padding: 5px;">${formatPaymentMethod(lastPayment.paymentMethod)}</td>
            </tr>
            ${lastPayment.reference ? `
            <tr>
              <td style="padding: 5px;"><strong>Référence:</strong></td>
              <td style="padding: 5px;">${lastPayment.reference}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div>
            <p style="margin-bottom: 40px;">Signature du payeur:</p>
            <p>_____________________</p>
          </div>
          <div>
            <p style="margin-bottom: 40px;">Signature du caissier:</p>
            <p>_____________________</p>
          </div>
        </div>
        
        <div style="margin-top: 20px; font-size: 10pt; text-align: center;">
          <p>${schoolInfo?.data?.address || ''}</p>
          <p>Tel: ${schoolInfo?.data?.phone || ''} - Email: ${schoolInfo?.data?.email || ''}</p>
        </div>
      </div>
    `;

    printJS({
      printable: content,
      type: 'raw-html',
      documentTitle: `Reçu de paiement - ${studentName}`,
      targetStyles: ['*'],
      style: `
        .receipt-container { max-width: 800px; margin: 0 auto; }
        @media print {
          body { font-size: 12pt; }
          .receipt-container { padding: 0; }
          @page { margin: 1cm; }
        }
      `
    });

    ElMessage.success('Reçu généré avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    ElMessage.error('Erreur lors de l\'impression du reçu');
  }
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const formatPaymentType = (type: string): string => {
  const types: Record<string, string> = {
    tuition: 'Frais de scolarité',
    registration: 'Inscription',
    uniform: 'Uniforme',
    transport: 'Transport',
    cafeteria: 'Cantine'
  };
  return types[type] || type;
};

const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    cash: 'Espèces',
    check: 'Chèque',
    transfer: 'Virement',
    mobile_money: 'Mobile Money'
  };
  return methods[method] || method;
};

const getAdjustedAnnualAmount = (studentId: number): number => {
  const student = students.value.find(s => s.id === studentId);
  if (!student?.grade?.id) return 0;

  const baseAmount = getAnnualAmount(student.grade.id);
  if (!student.scholarship?.length) return baseAmount;

  // Utiliser la bourse active
  const activeScholarship = student.scholarship.find(s => 
    s.isActive && s.schoolYear === new Date().getFullYear().toString()
  );
  
  if (!activeScholarship) return baseAmount;

  const reductionAmount = baseAmount * (activeScholarship.percentage / 100);
  return baseAmount - reductionAmount;
};

const loadStudentPayments = async (studentId: number) => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getByStudent', studentId);
    console.log(`=== Paiements pour l'étudiant ${studentId} ===`);
    console.log('Résultat brut:', result);

    if (result.success) {
      const { 
        payments, 
        baseAmount, 
        scholarshipPercentage, 
        scholarshipAmount, 
        adjustedAmount 
      } = result.data;

      console.log('Données extraites:', {
        payments,
        baseAmount,
        scholarshipPercentage,
        scholarshipAmount,
        adjustedAmount
      });
      
      const existingAmounts = paymentAmounts.value.get(studentId);
      console.log('Montants existants:', existingAmounts);
      
      const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      
      const newAmounts = {
        paid: totalPaid,
        remaining: adjustedAmount - totalPaid, // Utiliser le montant ajusté
        studentId,
        baseAmount,
        scholarshipPercentage,
        scholarshipAmount,
        adjustedAmount
      };

      console.log('Nouveaux montants calculés:', newAmounts);
      paymentAmounts.value.set(studentId, newAmounts);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
  }
};

const getStudentAdjustedAmount = (student: Student) => {
  if (!student?.grade?.id) return 0;
  
  const baseAmount = getAnnualAmount(student.grade.id);
  const scholarship = getActiveScholarship(student);
  
  console.log(`Calcul du montant ajusté pour ${student.firstname} ${student.lastname}:`);
  console.log('- Montant de base:', baseAmount);
  console.log('- Bourse active:', scholarship);
  
  if (!scholarship || !baseAmount) return baseAmount;
  
  const reduction = baseAmount * (scholarship.percentage / 100);
  const finalAmount = baseAmount - reduction;
  
  console.log('- Réduction:', reduction);
  console.log('- Montant final:', finalAmount);
  
  return finalAmount;
};

const getActiveScholarship = (student: Student) => {
  if (!student?.scholarship) return null;
  
  const currentYear = new Date().getFullYear().toString();
  console.log(`=== Recherche bourse active pour ${student.firstname} ${student.lastname} ===`);
  console.log('Année courante:', currentYear);
  console.log('Bourses disponibles:', student.scholarship);
  
  const activeScholarship = Array.isArray(student.scholarship) 
    ? student.scholarship.find(s => s.isActive && s.schoolYear === currentYear)
    : null;
    
  console.log('Bourse active trouvée:', activeScholarship);
  return activeScholarship;
};

const getScholarshipAmount = (student: Student) => {
  const scholarship = getActiveScholarship(student);
  if (!scholarship) return 0;
  const baseAmount = getAnnualAmount(student.grade?.id);
  return baseAmount * (scholarship.percentage / 100);
};

const getTotalScholarshipAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce((sum, amounts) => {
    return sum + (amounts.scholarshipAmount || 0);
  }, 0);
};
</script>

<style scoped>
.payment-management {
  height: 100vh;
  background-color: var(--el-bg-color-page);
}

.payment-header {
  padding: 20px;
  height: auto;
}

.stat-card {
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-regular);
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.payment-content {
  padding: 0 20px 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-filters {
  display: flex;
  gap: 15px;
  flex: 1;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-details {
  display: flex;
  flex-direction: column;
}

.student-name {
  font-weight: 500;
}

.student-matricule {
  color: var(--el-text-color-secondary);
}

.payment-progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.progress-details {
  color: var(--el-text-color-secondary);
  text-align: center;
  font-size: 0.9em;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* Responsive design */
@media (max-width: 1200px) {
  .search-filters {
    flex-direction: column;
  }
  
  .table-header {
    flex-direction: column;
    gap: 15px;
  }
}

@media (max-width: 768px) {
  .payment-header {
    padding: 10px;
  }
  
  .el-col {
    margin-bottom: 10px;
  }
}

.scholarship-info {
  color: var(--el-color-success);
  font-size: 0.85em;
  margin-top: 4px;
}

.scholarship-amount {
  font-size: 0.8em;
  color: var(--el-color-success);
  margin-top: 4px;
}

.stat-card.info {
  background-color: var(--el-color-info-light-9);
}

.payment-amount {
  display: flex;
  align-items: center;
  gap: 8px;
}

.el-tooltip__content {
  text-align: left;
}

.el-tooltip__content p {
  margin: 4px 0;
  white-space: nowrap;
}

.scholarship-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--el-color-success);
  font-size: 0.85em;
}
</style>
