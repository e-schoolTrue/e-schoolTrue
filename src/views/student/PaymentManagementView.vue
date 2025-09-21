<template>
  <el-container class="payment-management">
    <el-header class="payment-header">
      <el-row :gutter="15">
        <el-col :xs="24" :sm="8">
          <el-card class="stat-card success" shadow="hover">
            <div class="compact-stat-content">
              <div class="stat-info">
                <el-icon size="18"><Money /></el-icon>
                <span class="stat-label">Montant Collecté</span>
              </div>
              <currency-display class="stat-amount" :amount="getTotalCollectedAmount()" />
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="8">
          <el-card class="stat-card warning" shadow="hover">
            <div class="compact-stat-content">
              <div class="stat-info">
                <el-icon size="18"><Wallet /></el-icon>
                <span class="stat-label">Reste à Collecter</span>
              </div>
              <currency-display class="stat-amount" :amount="getTotalRemainingAmount()" />
            </div>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="8">
          <el-card class="stat-card info" shadow="hover">
            <div class="compact-stat-content">
              <div class="stat-info">
                <el-icon size="18"><Discount /></el-icon>
                <span class="stat-label">Réductions Bourses</span>
              </div>
              <currency-display class="stat-amount" :amount="getTotalScholarshipAmount()" />
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
                clearable
                @input="handleFilter"
                class="search-input"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              
              <div class="filters-group">
              <el-select 
                v-model="filters.grade" 
                placeholder="Classe"
                clearable
                @change="handleFilter"
                  class="filter-select"
              >
                  <template #prefix>
                    <el-icon><School /></el-icon>
                  </template>
                <el-option
                  v-for="grade in grades"
                  :key="grade.id"
                  :label="grade.name"
                  :value="grade.id"
                />
              </el-select>

              <el-select 
                v-model="filters.paymentStatus" 
                  placeholder="Statut"
                clearable
                @change="handleFilter"
                  class="filter-select"
                >
                  <template #prefix>
                    <el-icon><Filter /></el-icon>
                  </template>
                  <el-option label="Payé" value="paid">
                    <div class="status-option">
                      <el-tag type="success" size="small">Payé</el-tag>
                    </div>
                  </el-option>
                  <el-option label="Partiel" value="partial">
                    <div class="status-option">
                      <el-tag type="warning" size="small">Partiel</el-tag>
                    </div>
                  </el-option>
                  <el-option label="Non payé" value="unpaid">
                    <div class="status-option">
                      <el-tag type="danger" size="small">Non payé</el-tag>
                    </div>
                  </el-option>
              </el-select>
              </div>
            </div>

            <div class="table-actions">
              <el-button-group>
                <el-tooltip content="Exporter les données vers Excel" placement="top">
                <el-button
                  type="success"
                  :icon="Download"
                  @click="exportToExcel"
                  :loading="loading"
                >
                  Exporter Excel
                </el-button>
                </el-tooltip>
                <el-tooltip content="Actualiser les données" placement="top">
                <el-button
                  type="primary"
                  :icon="Refresh"
                  @click="refreshData"
                  :loading="loading"
                >
                  Actualiser
                </el-button>
                </el-tooltip>
              </el-button-group>
            </div>
          </div>
        </template>

          <el-table
          v-loading="loading"
          :data="students"
          border
          stripe
          height="35vh"
          highlight-current-row
          empty-text="Aucun étudiant trouvé"
          class="payment-table"
          style="width: 100%"
        >
          <el-table-column fixed type="expand">
            <template #default="props">
              <payment-history-mini :student="props.row" />
            </template>
          </el-table-column>

          <el-table-column 
            label="Élève" 
            min-width="220"
            sortable
            prop="lastname"
          >
            <template #default="{ row }">
              <div class="student-info">
                <el-avatar :size="40" :src="row.photo?.path" class="student-avatar">
                  {{ getInitials(row) }}
                </el-avatar>
                <div class="student-details">
                  <span class="student-name">{{ row.firstname }} {{ row.lastname }}</span>
                  <div class="student-info-row">
                    <span class="student-matricule">{{ row.matricule }}</span>
                    <el-tag size="small" effect="plain">{{ row.grade?.name || 'Sans classe' }}</el-tag>
                  </div>
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
                    <div class="scholarship-tooltip">
                      <div class="tooltip-title">Détails de la bourse</div>
                      <div class="tooltip-row">
                        <span>Montant initial:</span>
                      <currency-display :amount="getAnnualAmount(row.grade?.id)" />
                      </div>
                      <div class="tooltip-row">
                        <span>Réduction:</span>
                        <span>{{ getActiveScholarship(row)?.percentage }}%</span>
                      </div>
                      <div class="tooltip-row tooltip-highlight">
                        <span>Économie:</span>
                        <currency-display :amount="getScholarshipAmount(row)" />
                      </div>
                    </div>
                  </template>
                <div class="scholarship-info-card">
                <el-tag type="success" effect="dark" size="small">
                  {{ getActiveScholarship(row)?.percentage }}%
                </el-tag>
                <div class="scholarship-amount">
                  -<currency-display :amount="getScholarshipAmount(row)" />
                </div>
                </div>
                </el-tooltip>
              </template>
              <el-tag v-else type="info" effect="plain" size="small">Aucune bourse</el-tag>
            </template>
          </el-table-column>

          <el-table-column 
            label="Progression" 
            width="280"
          >
            <template #default="{ row }">
              <div class="payment-progress">
                <div class="fee-progress">
                  <div class="fee-label">Inscription:</div>
                  <el-progress
                      :percentage="getInscriptionProgress(row.id)"
                      :status="getFeeProgressStatus(getInscriptionProgress(row.id))"
                      :stroke-width="8"
                  />
                  <div class="progress-details">
                    <currency-display :amount="paymentAmounts.get(row.id)?.paidInscriptionFee || 0" class="paid-amount" /> 
                    <span class="separator">/</span> 
                    <currency-display :amount="paymentAmounts.get(row.id)?.inscriptionFeeDue || 0" class="total-amount" />
                  </div>
                </div>
                <div class="fee-progress">
                  <div class="fee-label">Scolarité:</div>
                  <el-progress
                      :percentage="getTuitionProgress(row.id)"
                      :status="getFeeProgressStatus(getTuitionProgress(row.id))"
                      :stroke-width="8"
                  />
                  <div class="progress-details">
                    <currency-display :amount="paymentAmounts.get(row.id)?.paidTuition || 0" class="paid-amount" /> 
                    <span class="separator">/</span> 
                    <currency-display :amount="paymentAmounts.get(row.id)?.adjustedTuitionFee || 0" class="total-amount" />
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column 
            label="Statut" 
            width="120"
            align="center"
            sortable
            :sort-method="(a: Student, b: Student) => {
              const statusOrder = { paid: 0, partial: 1, unpaid: 2 };
              return statusOrder[getPaymentStatus(a.id)] - statusOrder[getPaymentStatus(b.id)];
            }"
          >
            <template #default="{ row }">
              <el-tag
                :type="getPaymentStatusType(row.id)"
                effect="dark"
                size="default"
                class="status-tag"
              >
                {{ getPaymentStatusLabel(row.id) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column 
            label="Actions" 
            width="220" 
            fixed="right"
            align="center"
          >
            <template #default="{ row }">
              <el-button-group class="action-buttons">
                <el-tooltip content="Voir l'historique des paiements" placement="top">
                <el-button
                  type="primary"
                  size="small"
                  @click="showPaymentHistory(row)"
                >
                  <el-icon><Document /></el-icon>
                </el-button>
                </el-tooltip>
                <el-tooltip content="Imprimer un reçu" placement="top">
                <el-button
                  type="success"
                  size="small"
                  @click="printReceipt(row)"
                >
                  <el-icon><Printer /></el-icon>
                </el-button>
                </el-tooltip>
                <el-tooltip content="Ajouter un paiement" placement="top">
                <el-button
                  type="warning"
                  size="small"
                  @click="openPaymentDialog(row)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
                </el-tooltip>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>

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
            class="custom-pagination"
          />
        </div>
      </el-card>
    </el-main>

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
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Document, Download, Refresh, Printer, Discount, Money, Wallet, Search, Filter, School } from "@element-plus/icons-vue";
import PaymentDialog from '@/components/payment/PaymentDialog.vue';
import PaymentHistoryDialog from '@/components/payment/PaymentHistory.vue';
import PaymentHistoryMini from '@/components/payment/PaymentHistoryMini.vue';
import * as XLSX from 'xlsx';
import { PaymentConfig } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';
import { useRouter } from 'vue-router';
// @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  grade?: {
    id: number;
    name: string;
  };
  isNew?: boolean;
}

interface Grade {
  id: number;
  name: string;
}

interface Filters {
  studentFullName: string;
  grade?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
}

interface PaymentAmounts {
  inscriptionFeeDue: number;
  tuitionFeeDue: number;
  paidInscriptionFee: number;
  paidTuition: number;
  totalPaid: number;
  remainingInscriptionFee: number;
  remainingTuition: number;
  totalRemaining: number;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedTuitionFee: number;
  totalDue: number;
}

const students = ref<Student[]>([]);
const grades = ref<Grade[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const totalStudents = ref(0);
const paymentDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const selectedStudent = ref<Student | null>(null);
const classConfigs = ref(new Map<number, PaymentConfig>());
const paymentAmounts = ref(new Map<number, PaymentAmounts>());
const trancheConfigs = ref(new Map<number, PaymentAnnualConfigEntity>());
const filters = ref<Filters>({
  studentFullName: "",
  grade: undefined,
  paymentStatus: undefined
});
const router = useRouter();

const loadPaymentConfigs = async () => {
  try {
    const result = await window.ipcRenderer.invoke("payment:getConfigs");
    if (result?.success && Array.isArray(result.data)) {
      const newConfigs = new Map<number, PaymentConfig>();
      result.data.forEach((config: PaymentConfig) => {
        const classId = Number(config.classId);
        if (!isNaN(classId)) {
          newConfigs.set(classId, config);
        }
      });
      classConfigs.value = newConfigs;
    }
  } catch (error) {
    console.error("Erreur lors du chargement des configurations de paiement:", error);
  }
};

const loadTrancheConfigs = async () => {
  try {
    const result = await window.ipcRenderer.invoke('tranche-config:all');
    if (result.success && Array.isArray(result.data)) {
      const newTrancheConfigs = new Map<number, PaymentAnnualConfigEntity>();
      result.data.forEach((config: PaymentAnnualConfigEntity) => {
        newTrancheConfigs.set(Number(config.grade?.id), config);
      });
      trancheConfigs.value = newTrancheConfigs;
    }
  } catch (error) {
    console.error("Erreur lors du chargement des configurations de tranches:", error);
  }
};

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result?.success && Array.isArray(result.data)) {
      grades.value = result.data;
    }
  } catch (error) {
    console.error("Erreur lors du chargement des niveaux scolaires:", error);
  }
};

const getAnnualAmount = (gradeId: number | undefined): number => {
  if (!gradeId) return 0;
  const config = classConfigs.value.get(gradeId);
  return config?.annualAmount || 0;
};

const getConfigForStudent = (student: Student | null): PaymentConfig | null => {
  if (!student?.grade?.id) return null;
  return classConfigs.value.get(student.grade.id) || null;
};

const loadStudents = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('student:all', {
      page: currentPage.value,
      pageSize: pageSize.value,
      filters: {
        studentFullName: filters.value.studentFullName,
        grade: filters.value.grade
      }
    });
    
    if (result.success && result.data) {
      students.value = result.data.students;
      totalStudents.value = result.data.total;

      for (const student of students.value) {
        await loadStudentPayments(student.id);
      }

      if (filters.value.paymentStatus) {
        students.value = students.value.filter(student => {
          const status = getPaymentStatus(student.id);
          return status === filters.value.paymentStatus;
        });
      }

    } else {
      ElMessage.error('Erreur lors du chargement des étudiants');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des étudiants:', error);
    ElMessage.error('Erreur lors du chargement des données des étudiants');
  } finally {
    loading.value = false;
  }
};

const loadStudentPayments = async (studentId: number) => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getByStudent', studentId);
    if (result.success && result.data) {
      paymentAmounts.value.set(studentId, result.data);
    } else {
      console.warn(`Could not load payment amounts for student ${studentId}`);
    }
  } catch (error) {
    console.error(`Error loading payment amounts for student ${studentId}:`, error);
  }
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  loadStudents();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadStudents();
};

const handleFilter = () => {
    currentPage.value = 1;
    loadStudents();
};

const openPaymentDialog = (student: Student) => {
  selectedStudent.value = student;
  paymentDialogVisible.value = true;
};

const showPaymentHistory = (student: Student) => {
  selectedStudent.value = student;
  historyDialogVisible.value = true;
};

const handlePaymentAdded = async () => {
  if (selectedStudent.value) {
    await loadStudentPayments(selectedStudent.value.id);
  }
  paymentDialogVisible.value = false;
};

const exportToExcel = async () => {
  // This function needs to be updated to handle the new data structure
};

const refreshData = () => {
  loadStudents();
};

const getPaidAmount = (studentId: number): number => {
  const amounts = paymentAmounts.value.get(studentId);
  return amounts?.totalPaid || 0;
};

const getAdjustedAnnualAmount = (studentId: number): number => {
  const amounts = paymentAmounts.value.get(studentId);
  return amounts?.totalDue || 0;
};

const getPaymentProgress = (studentId: number) => {
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts || !amounts.totalDue) return 0;
  return Math.round((amounts.totalPaid / amounts.totalDue) * 100);
};

const getInscriptionProgress = (studentId: number) => {
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts || !amounts.inscriptionFeeDue) return 0;
  return Math.round((amounts.paidInscriptionFee / amounts.inscriptionFeeDue) * 100);
};

const getTuitionProgress = (studentId: number) => {
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts || !amounts.adjustedTuitionFee) return 0;
  return Math.round((amounts.paidTuition / amounts.adjustedTuitionFee) * 100);
};

const getFeeProgressStatus = (progress: number) => {
  if (progress >= 100) return "success";
  if (progress > 0) return "warning";
  return "exception";
};

const getProgressStatus = (studentId: number) => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return "success";
  if (progress > 0) return "warning";
  return "exception";
};

const getTotalCollectedAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce((sum, amounts) => sum + amounts.totalPaid, 0);
};

const getTotalRemainingAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce((sum, amounts) => sum + amounts.totalRemaining, 0);
};

const getTotalScholarshipAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce((sum, amounts) => sum + amounts.scholarshipAmount, 0);
};

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
    await loadPaymentConfigs();
    await loadTrancheConfigs();
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
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts) return 'unpaid';
  if (amounts.totalRemaining <= 0) return 'paid';
  if (amounts.totalPaid > 0) return 'partial';
  return 'unpaid';
};

const getActiveScholarship = (student: Student) => {
  const amounts = paymentAmounts.value.get(student.id);
  if (amounts && amounts.scholarshipPercentage > 0) {
      return { percentage: amounts.scholarshipPercentage };
  }
  return null;
};

const getScholarshipAmount = (student: Student) => {
    const amounts = paymentAmounts.value.get(student.id);
    return amounts?.scholarshipAmount || 0;
};

const getTrancheInfo = (student: Student) => {
  if (!student.grade?.id) return '';
  const trancheConfig = trancheConfigs.value.get(student.grade.id);
  if (!trancheConfig || !trancheConfig.tranches?.length) return '';

  const amounts = paymentAmounts.value.get(student.id);
  const paidTuition = amounts?.paidTuition || 0;

  let cumulativeAmount = 0;
  let currentTrancheNum = 0;

  for (const tranche of trancheConfig.tranches) {
    currentTrancheNum++;
    // @ts-ignore
    cumulativeAmount += tranche.amount;
    if (paidTuition < cumulativeAmount) {
      return `Tranche ${currentTrancheNum} / ${trancheConfig.trancheCount}`;
    }
  }
  return `Toutes les tranches payées`;
};

</script>
<style scoped>
.payment-management {
  height: 100vh;
  background-color: var(--el-bg-color-page);
}

.payment-header {
  padding: 10px 20px;
  height: auto;
  max-height: 120px;
}

.stat-card {
  transition: transform 0.3s ease;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 5px;
}

.compact-stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
}

.stat-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.stat-amount {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.payment-content {
  padding: 0 20px 20px;
}

.payment-table-card {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

.search-filters {
  display: flex;
  gap: 10px;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
}

.filters-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input {
  min-width: 200px;
  max-width: 300px;
}

.filter-select {
  width: 150px;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid white;
}

.student-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.student-name {
  font-weight: 600;
  font-size: 14px;
}

.student-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.student-matricule {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.payment-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.payment-progress-bar {
  margin-bottom: 4px;
}

.progress-details {
  color: var(--el-text-color-secondary);
  text-align: center;
  font-size: 13px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
}

.paid-amount {
  color: var(--el-color-success);
  font-weight: 500;
}

.separator {
  opacity: 0.6;
}

.total-amount {
  opacity: 0.8;
}

.status-tag {
  padding: 0 12px;
  height: 26px;
  line-height: 26px;
  font-weight: 500;
}

.action-buttons {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  border-radius: 4px;
}

.pagination-container {
  margin-top: 25px;
  display: flex;
  justify-content: flex-end;
}

.custom-pagination {
  padding: 5px;
  border-radius: 4px;
  background-color: var(--el-bg-color-page);
}

.scholarship-info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.scholarship-amount {
  font-size: 12px;
  color: var(--el-color-success);
  font-weight: 500;
}

.scholarship-tooltip {
  padding: 4px;
  min-width: 200px;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.tooltip-highlight {
  font-weight: 600;
  color: var(--el-color-success);
}

.payment-table {
  --el-table-header-bg-color: var(--el-color-primary-light-9);
  --el-table-row-hover-bg-color: var(--el-color-primary-light-9);
  width: 100%;
}

.el-table {
  overflow-x: auto;
  max-width: 100%;
}

.tranche-info {
  margin-top: 4px;
  text-align: center;
}

.fee-progress {
  margin-bottom: 10px;
}

.fee-label {
  font-weight: 500;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
}

/* Responsive design */
@media (max-width: 1200px) {
  .search-filters {
    flex-direction: column;
    gap: 10px;
  }
  
  .search-input, .filter-select {
    width: 100%;
    min-width: unset;
  }
  
  .table-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .table-actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .payment-progress-bar {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .payment-header {
    padding: 10px;
  }
  
  .el-col {
    margin-bottom: 10px;
  }
  
  .stat-amount {
    font-size: 22px;
  }
  
  .table-actions {
    width: 100%;
    justify-content: center;
  }
  
  .action-buttons {
    width: 100%;
  display: flex;
    justify-content: space-between;
  }
  
  .el-button-group .el-button {
    flex: 1;
  }
  
  .pagination-container {
    justify-content: center;
  }
}
</style>