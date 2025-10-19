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
                <el-tooltip content="Exporter les données vers PDF" placement="top">
                <el-button
                  type="danger"
                  :icon="Document"
                  @click="exportToPdf"
                  :loading="loadingPdf"
                >
                  Exporter PDF
                </el-button>
                </el-tooltip>
                <el-tooltip content="Exporter les données vers Excel" placement="top">
                <el-button
                  type="success"
                  :icon="Download"
                  @click="exportToExcel"
                  :loading="loadingExcel"
                >
                  Exporter Excel
                </el-button>
                </el-tooltip>
                <el-tooltip content="Bordereau journalier" placement="top">
                <el-button
                  type="warning"
                  :icon="Printer"
                  @click="showDailyReport"
                >
                  Bordereau du jour
                </el-button>
                </el-tooltip>
                <el-tooltip content="Actualiser les données" placement="top">
                <el-button
                  type="primary"
                  :icon="Refresh"
                  @click="refreshData"
                  :loading="loadingRefresh"
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

    <payment-daily
      v-model:visible="dailyReportVisible"
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Document, Download, Refresh, Printer, Discount, Money, Wallet, Search, Filter, School } from "@element-plus/icons-vue";
import PaymentDialog from '@/components/payment/PaymentDialog.vue';
import PaymentHistoryDialog from '@/components/payment/PaymentHistory.vue';
import PaymentHistoryMini from '@/components/payment/PaymentHistoryMini.vue';
import PaymentDaily from '@/components/payment/PaymentDaily.vue';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import { PaymentConfig } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';

// @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';
// @ts-ignore
import { YearRepartitionEntity } from '#electron/backend/entities/yearRepartition';

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
  tuitionDueToDate?: number;
}

const students = ref<Student[]>([]);
const grades = ref<Grade[]>([]);
const loading = ref(false);
const loadingPdf = ref(false);
const loadingExcel = ref(false);
const loadingRefresh = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const totalStudents = ref(0);
const paymentDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const dailyReportVisible = ref(false);
const selectedStudent = ref<Student | null>(null);
const classConfigs = ref(new Map<number, PaymentConfig>());
const paymentAmounts = ref(new Map<number, PaymentAmounts>());
const trancheConfigs = ref(new Map<number, PaymentAnnualConfigEntity>());
const yearRepartition = ref<YearRepartitionEntity | null>(null);
const filters = ref<Filters>({
  studentFullName: "",
  grade: undefined,
  paymentStatus: undefined
});


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

const getTuitionDueToDate = (student: Student): number => {
  if (!student?.grade?.id) return 0;

  const annualConfig = trancheConfigs.value.get(student.grade.id);
  const amounts = paymentAmounts.value.get(student.id);
  const totalTuition = amounts?.adjustedTuitionFee || 0;

  if (!annualConfig || !annualConfig.tranches || !yearRepartition.value?.periodConfigurations) {
    return totalTuition;
  }

  const today = new Date();
  let dueAmount = 0;
  const periods = yearRepartition.value.periodConfigurations;

  annualConfig.tranches.forEach((tranche, index) => {
      if (periods[index]) {
        const period = periods[index];
        const dueDate = new Date(period.start);
        if (dueDate <= today) {
          dueAmount += Number(tranche.amount);
        }
      }
  });

  return dueAmount;
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
        const amounts = paymentAmounts.value.get(student.id);
        if (amounts) {
          amounts.tuitionDueToDate = getTuitionDueToDate(student);
          paymentAmounts.value.set(student.id, amounts);
        }
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

const showDailyReport = () => {
  dailyReportVisible.value = true;
};

const handlePaymentAdded = async () => {
  if (selectedStudent.value) {
    await loadStudentPayments(selectedStudent.value.id);
  }
  paymentDialogVisible.value = false;
};

const exportToExcel = async () => {
  loadingExcel.value = true;
  try {
    // 1. Fetch all students with current filters
    const result = await window.ipcRenderer.invoke("student:all", {
      page: 1,
      pageSize: totalStudents.value === 0 ? 1000 : totalStudents.value, // Fetch all, with a fallback
      filters: {
        studentFullName: filters.value.studentFullName,
        grade: filters.value.grade
      }
    });

    if (!result.success || !result.data) {
      ElMessage.error("Erreur lors de la récupération des données à exporter.");
      return;
    }

    let allStudents: Student[] = result.data.students;

    // 2. Fetch payment info for all students
    await Promise.all(allStudents.map((s: Student) => loadStudentPayments(s.id)));

    // 2.5 Calculate due dates for all students
    for (const student of allStudents) {
        const amounts = paymentAmounts.value.get(student.id);
        if (amounts) {
          amounts.tuitionDueToDate = getTuitionDueToDate(student);
          paymentAmounts.value.set(student.id, amounts);
        }
    }

    // 3. Filter by payment status if needed
    if (filters.value.paymentStatus) {
      allStudents = allStudents.filter((student: Student) => {
        const status = getPaymentStatus(student.id);
        return status === filters.value.paymentStatus;
      });
    }

    // 4. Prepare data for export
    const dataForExport = allStudents.map((student: Student) => {
      const paymentInfo = paymentAmounts.value.get(student.id);
      return {
        "Matricule": student.matricule,
        "Nom": student.lastname,
        "Prénom": student.firstname,
        "Classe": student.grade?.name || "N/A",
        "Statut": getPaymentStatusLabel(student.id),
        "Total Dû": paymentInfo?.totalDue || 0,
        "Total Payé": paymentInfo?.totalPaid || 0,
        "Reste à Payer": paymentInfo?.totalRemaining || 0,
        "Bourse (%)": paymentInfo?.scholarshipPercentage || 0
      };
    });

    if (dataForExport.length === 0) {
      ElMessage.warning("Aucune donnée à exporter pour les filtres actuels.");
      return;
    }

    // 5. Create and download Excel file
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Paiements");
    XLSX.writeFile(workbook, `export_paiements_${new Date().toISOString().slice(0,10)}.xlsx`);

  } catch (error) {
    console.error("Erreur lors de l'export Excel:", error);
    ElMessage.error("Une erreur est survenue lors de l'exportation.");
  } finally {
    loadingExcel.value = false;
  }
};

const refreshData = async () => {
  loadingRefresh.value = true;
  try {
    await loadStudents();
  } finally {
    loadingRefresh.value = false;
  }
};

const printReceipt = async (student: Student) => {
  if (!student) {
    ElMessage.error("Aucun étudiant sélectionné pour l'impression.");
    return;
  }

  try {
    // 1. Récupérer toutes les données nécessaires
    const [paymentsResult, schoolInfoResult, customConfigsResult, paymentConfigResult, trancheConfigResult] = await Promise.all([
      window.ipcRenderer.invoke('payment:getByStudent', student.id),
      window.ipcRenderer.invoke('school:get'),
      window.ipcRenderer.invoke('payment:getCustomConfigs'),
      window.ipcRenderer.invoke('payment:getConfigs'),
      window.ipcRenderer.invoke('tranche-config:all')
    ]);
    
    if (!paymentsResult.success) {
      ElMessage.error("Erreur lors de la récupération des paiements de l'étudiant.");
      return;
    }
    
    // Extraire les paiements de la réponse
    const payments = paymentsResult.data?.payments || [];
    const paymentInfo = paymentAmounts.value.get(student.id);
    const schoolInfo = schoolInfoResult?.data || {};
    
    // Récupérer la configuration de paiement pour cette classe
    const classPaymentConfig = paymentConfigResult.success ?
      paymentConfigResult.data.find((config: any) => config.classId === student.grade?.id) : null;
    
    // Récupérer la configuration personnalisée pour cette classe
    const customConfig = customConfigsResult.success ?
      customConfigsResult.data.find((config: any) => config.gradeId === student.grade?.id && config.isDefault) : null;
    
    // Calculer le nombre de mois payés
    const totalPaidTuition = paymentInfo?.paidTuition || 0;
    const totalTuition = paymentInfo?.adjustedTuitionFee || classPaymentConfig?.annualAmount || 0;
    let monthsPaid = 0;
    let monthlyAmount = 0;
    
    if (customConfig && customConfig.paymentType === 'monthly' && customConfig.monthlyConfig) {
      const config = customConfig.monthlyConfig;
      monthlyAmount = totalTuition / config.numberOfMonths;
      monthsPaid = Math.floor(totalPaidTuition / monthlyAmount);
    } else if (totalTuition > 0) {
      // Par défaut, considérer 10 mois (septembre à juin)
      monthlyAmount = totalTuition / 10;
      monthsPaid = Math.floor(totalPaidTuition / monthlyAmount);
    }
    
    // Récupérer le logo de l'école si disponible (même structure que SchoolInfoView.vue)
    let logoBase64 = '';
    
    // Vérifier si l'école a un logo (objet avec id)
    if (schoolInfo && schoolInfo.logo && schoolInfo.logo.id) {
      try {
        const logoResult = await window.ipcRenderer.invoke('school:getLogo', schoolInfo.logo.id);
        
        if (logoResult.success && logoResult.data && logoResult.data.content) {
          // Construire l'URL base64 comme dans SchoolInfoView.vue
          logoBase64 = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du logo:', error);
      }
    }

    // Fonction pour générer la grille de mois
    const generateMonthlyGrid = (monthsPaid: number, _monthlyAmount: number, customConfig: any) => {
      const allMonths = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      
      let monthsToShow = [];
      let startMonth = 8; // Septembre par défaut (index 8)
      let excludedMonths: number[] = [];
      
      if (customConfig && customConfig.paymentType === 'monthly' && customConfig.monthlyConfig) {
        const config = customConfig.monthlyConfig;
        startMonth = config.startMonth - 1; // Convertir en index 0-based
        excludedMonths = config.excludedMonths || [];
        
        // Créer la liste des mois à afficher en fonction de la configuration
        for (let i = 0; i < config.numberOfMonths; i++) {
          let currentMonthIndex = (startMonth + i) % 12;
          // Sauter les mois exclus
          while (excludedMonths.includes(currentMonthIndex + 1)) {
            currentMonthIndex = (currentMonthIndex + 1) % 12;
          }
          monthsToShow.push({
            name: allMonths[currentMonthIndex],
            index: currentMonthIndex,
            isPaid: i < monthsPaid
          });
        }
      } else {
        // Configuration par défaut : Septembre à Juin (10 mois)
        const defaultMonths = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5]; // Sep, Oct, Nov, Dec, Jan, Fev, Mar, Avr, Mai, Juin
        monthsToShow = defaultMonths.map((monthIndex, i) => ({
          name: allMonths[monthIndex],
          index: monthIndex,
          isPaid: i < monthsPaid
        }));
      }
      
      return monthsToShow.map(month => `
        <div class="month-box">
          <span class="month-checkbox ${month.isPaid ? 'checked' : ''}">
            ${month.isPaid ? '✓' : ''}
          </span>
          <span class="month-name">${month.name}</span>
        </div>
      `).join('');
    };

    // 2. Create HTML for the receipt with improved styling
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reçu de paiement - ${student.firstname} ${student.lastname}</title>
        <style>
          @media print {
            @page { 
              margin: 10mm; 
              size: A4;
            }
            body { 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            .receipt-container {
              padding: 10px !important;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
          
          * {
            box-sizing: border-box;
          }
          
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0;
            padding: 10px;
            font-size: 12px; 
            line-height: 1.3;
            color: #333;
            background: white;
          }
          
          .receipt-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            border-bottom: 2px solid #007bff; 
            padding-bottom: 10px; 
            margin-bottom: 15px;
            position: relative;
          }
          
          .school-logo {
            width: 80px;
            height: 80px;
            max-width: 80px;
            max-height: 80px;
            object-fit: contain;
            margin-right: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 5px;
            background: white;
            display: block;
          }
          
          .school-header {
            display: flex;
            align-items: center;
            flex: 1;
          }
          
          .school-info h1 { 
            font-size: 18px; 
            margin: 0 0 5px 0; 
            color: #007bff;
            font-weight: bold;
          }
          
          .school-info p { 
            margin: 2px 0; 
            color: #666;
            font-size: 11px;
          }
          
          .receipt-info { 
            text-align: right; 
          }
          
          .receipt-info h2 { 
            font-size: 16px; 
            margin: 0 0 5px 0; 
            color: #007bff;
            font-weight: bold;
          }
          
          .receipt-info p {
            margin: 2px 0;
            color: #666;
            font-size: 11px;
          }
          
          .student-section {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            border-left: 3px solid #007bff;
          }

          .payment-schedule-section {
            background: #fff8e1;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            border-left: 3px solid #ff9800;
          }

          .payment-schedule-section h3 {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #e65100;
          }
          
          .monthly-payment-grid {
            background: #f0f8ff;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
            border-left: 3px solid #2196f3;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .monthly-payment-grid h3 {
            margin: 0 0 10px 0;
            font-size: 13px;
            color: #1565c0;
          }
          
          .months-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
          }
          
          .month-box {
            display: flex;
            align-items: center;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            font-size: 10px;
          }
          
          .month-checkbox {
            width: 14px;
            height: 14px;
            border: 1px solid #333;
            border-radius: 2px;
            margin-right: 5px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #4caf50;
          }
          
          .month-checkbox.checked {
            background: #e8f5e9;
          }
          
          .month-name {
            flex: 1;
            font-weight: 500;
          }
          
          .month-amount {
            font-size: 9px;
            color: #666;
            margin-left: 5px;
          }

          .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            font-size: 10px;
          }

          .schedule-table th,
          .schedule-table td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: left;
          }

          .schedule-table th {
            background-color: #ff9800;
            color: white;
            font-weight: 600;
            text-align: center;
          }

          .status-payé {
            color: #4caf50;
            font-weight: bold;
          }

          .status-partiel {
            color: #ff9800;
            font-weight: bold;
          }

          .status-non-payé {
            color: #f44336;
            font-weight: bold;
          }
          
          .student-section h3 { 
            margin: 0 0 5px 0; 
            font-size: 14px;
            color: #333;
          }
          
          .student-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
            margin-top: 8px;
          }
          
          .detail-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #e9ecef;
          }
          
          .detail-label {
            font-weight: 600;
            color: #495057;
          }
          
          .detail-value {
            color: #007bff;
            font-weight: 500;
          }
          
          .payments-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0;
            background: white;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          }
          
          .payments-table th { 
            background: #007bff; 
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .payments-table td { 
            border-bottom: 1px solid #e9ecef; 
            padding: 6px; 
            font-size: 11px;
          }
          
          .payments-table tbody tr:hover {
            background-color: #f8f9fa;
          }
          
          .payments-table tbody tr:last-child td {
            border-bottom: none;
          }
          
          .no-payments {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 15px;
          }
          
          .summary { 
            margin-top: 15px;
            background: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
          }
          
          .summary-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .summary-table td { 
            padding: 5px 0;
            border: none;
            font-size: 12px;
          }
          
          .summary-table .label {
            font-weight: 600;
            color: #495057;
            width: 60%;
          }
          
          .summary-table .value {
            text-align: right;
            font-weight: 600;
            color: #007bff;
          }
          
          .summary-table .total-row {
            border-top: 2px solid #007bff;
            padding-top: 8px;
          }
          
          .summary-table .total-row td {
            font-size: 14px;
            font-weight: bold;
            color: #007bff;
            padding-top: 8px;
          }
          
          .footer { 
            margin-top: 20px; 
            text-align: center; 
            font-size: 10px; 
            color: #6c757d;
            border-top: 1px solid #e9ecef;
            padding-top: 10px;
          }
          
          .print-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            margin: 10px 0;
            transition: background-color 0.3s;
          }
          
          .print-button:hover {
            background: #0056b3;
          }
          
          @media (max-width: 600px) {
            .header {
              flex-direction: column;
              gap: 20px;
            }
            
            .receipt-info {
              text-align: left;
            }
            
            .student-details {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div class="school-header">
              ${logoBase64 ? `
                <div style="width: 90px; margin-right: 15px;">
                  <img 
                    src="${logoBase64}" 
                    alt="Logo de l'école" 
                    class="school-logo" 
                    onerror="this.style.display='none'; console.error('Erreur chargement logo');" 
                  />
                </div>
              ` : ''}
              <div class="school-info">
                <h1>${schoolInfo.name || 'École'}</h1>
                <p><strong>Adresse:</strong> ${schoolInfo.address || 'Non renseignée'}</p>
                <p><strong>Téléphone:</strong> ${schoolInfo.phone || 'Non renseigné'}</p>
                <p><strong>Email:</strong> ${schoolInfo.email || 'Non renseigné'}</p>
                ${schoolInfo.website ? `<p><strong>Site web:</strong> ${schoolInfo.website}</p>` : ''}
                ${schoolInfo.director ? `<p><strong>Directeur:</strong> ${schoolInfo.director}</p>` : ''}
              </div>
            </div>
            <div class="receipt-info">
              <h2>Reçu de Paiement</h2>
              <p><strong>N° Reçu:</strong> ${Date.now().toString().slice(-8)}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
              <p><strong>Heure:</strong> ${new Date().toLocaleTimeString('fr-FR')}</p>
            </div>
          </div>

          <div class="student-section">
            <h3>Informations de l'étudiant</h3>
            <div class="student-details">
              <div class="detail-item">
                <span class="detail-label">Nom complet:</span>
                <span class="detail-value">${student.firstname} ${student.lastname}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Matricule:</span>
                <span class="detail-value">${student.matricule || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Classe:</span>
                <span class="detail-value">${student.grade?.name || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Statut:</span>
                <span class="detail-value">${getPaymentStatusLabel(student.id)}</span>
              </div>
            </div>
          </div>

          <!-- Section de la grille de paiements mensuels -->
          ${totalTuition > 0 ? `
          <div class="monthly-payment-grid">
            <h3>Suivi des Paiements Mensuels</h3>
            <div class="months-grid">
              ${generateMonthlyGrid(monthsPaid, monthlyAmount, customConfig)}
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #666;">
              <strong>Montant mensuel:</strong> ${formatCurrency(monthlyAmount)} | 
              <strong>Mois payés:</strong> ${monthsPaid} / ${customConfig?.monthlyConfig?.numberOfMonths || 10}
            </div>
          </div>
          ` : ''}

          <!-- Section des échéances de paiement (tranches personnalisées) si disponibles -->
          ${customConfig && customConfig.paymentType === 'installments' && customConfig.installmentConfig ? `
          <div class="payment-schedule-section">
            <h3>Échéancier de Paiement - ${student.grade?.name}</h3>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Tranche</th>
                  <th>Mois</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                ${customConfig.installmentConfig.installments.map((tranche: any, index: number) => {
                  const amount = formatCurrency(tranche.amount);
                  
                  // Calculer le statut de paiement pour cette tranche
                  const paidAmount = payments
                    .filter((p: any) => p.paymentType === 'tuition')
                    .reduce((sum: number, p: any) => sum + p.amount, 0);
                  
                  const tranchesTotal = customConfig.installmentConfig.installments
                    .slice(0, index + 1)
                    .reduce((sum: number, t: any) => sum + t.amount, 0);
                  
                  let status = 'Non payé';
                  if (paidAmount >= tranchesTotal) status = 'Payé';
                  else if (paidAmount > tranchesTotal - tranche.amount) status = 'Partiel';
                  
                  const monthNames = [
                    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                  ];
                  const monthName = monthNames[tranche.month - 1] || `Mois ${tranche.month}`;
                  
                  return `
                    <tr>
                      <td>Tranche ${index + 1}</td>
                      <td>${monthName}</td>
                      <td>${amount}</td>
                      <td class="status-${status.toLowerCase().replace(' ', '-')}">${status}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <!-- Section des tranches (ancienne méthode) si disponibles -->
          ${(!customConfig || customConfig.paymentType !== 'installments') && trancheConfigResult.success && trancheConfigResult.data ? (() => {
            const studentTranche = trancheConfigResult.data.find((config: any) => config.grade?.id === student.grade?.id);
            if (studentTranche && studentTranche.tranches) {
              return `
              <div class="payment-schedule-section">
                <h3>Échéancier de Paiement - ${student.grade?.name}</h3>
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th>Tranche</th>
                      <th>Montant</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${studentTranche.tranches.map((tranche: any, index: number) => {
                      const amount = formatCurrency(tranche.amount);
                      const paidAmount = payments
                        .filter((p: any) => p.paymentType === 'tuition')
                        .reduce((sum: number, p: any) => sum + p.amount, 0);
                      const tranchesTotal = studentTranche.tranches
                        .slice(0, index + 1)
                        .reduce((sum: number, t: any) => sum + t.amount, 0);
                      
                      let status = 'Non payé';
                      if (paidAmount >= tranchesTotal) status = 'Payé';
                      else if (paidAmount > tranchesTotal - tranche.amount) status = 'Partiel';
                      
                      return `
                        <tr>
                          <td>${tranche.name || tranche.tranchName || `Tranche ${index + 1}`}</td>
                          <td>${amount}</td>
                          <td class="status-${status.toLowerCase().replace(' ', '-')}">${status}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              `;
            }
            return '';
          })() : ''}
          
          <table class="payments-table">
            <thead>
              <tr>
                <th>Date de paiement</th>
                <th>Type de frais</th>
                <th>Montant payé</th>
                <th>Méthode de paiement</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length > 0 ? 
                payments.map((p: any) => `
                  <tr>
                    <td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>${p.paymentType === 'inscription' ? "Frais d'inscription" : 'Frais de scolarité'}</td>
                    <td>${formatCurrency(p.amount)}</td>
                    <td>${p.paymentMethod || 'N/A'}</td>
                  </tr>
                `).join('') :
                '<tr><td colspan="4" class="no-payments">Aucun paiement enregistré pour cet étudiant</td></tr>'
              }
            </tbody>
          </table>

          <div class="summary">
            <h3 style="margin: 0 0 8px 0; color: #007bff; font-size: 14px;">Résumé Financier</h3>
            <table class="summary-table">
              <tr>
                <td class="label">Frais d'inscription:</td>
                <td class="value">${formatCurrency(paymentInfo?.inscriptionFeeDue || 0)}</td>
              </tr>
              <tr>
                <td class="label">Payé (inscription):</td>
                <td class="value">${formatCurrency(paymentInfo?.paidInscriptionFee || 0)}</td>
              </tr>
              <tr>
                <td class="label">Frais de scolarité:</td>
                <td class="value">${formatCurrency(paymentInfo?.adjustedTuitionFee || 0)}</td>
              </tr>
              <tr>
                <td class="label">Payé (scolarité):</td>
                <td class="value">${formatCurrency(paymentInfo?.paidTuition || 0)}</td>
              </tr>
              ${paymentInfo?.scholarshipAmount ? `
              <tr>
                <td class="label">Réduction bourse (${paymentInfo.scholarshipPercentage}%):</td>
                <td class="value" style="color: #4caf50;">-${formatCurrency(paymentInfo.scholarshipAmount)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #007bff;">
                <td class="label"><strong>Total des frais dus:</strong></td>
                <td class="value"><strong>${formatCurrency(paymentInfo?.totalDue || 0)}</strong></td>
              </tr>
              <tr>
                <td class="label"><strong>Total payé:</strong></td>
                <td class="value" style="color: #4caf50;"><strong>${formatCurrency(paymentInfo?.totalPaid || 0)}</strong></td>
              </tr>
              <tr class="total-row">
                <td class="label"><strong>Reste à payer:</strong></td>
                <td class="value" style="color: ${(paymentInfo?.totalRemaining || 0) > 0 ? '#f44336' : '#4caf50'};"><strong>${formatCurrency(paymentInfo?.totalRemaining || 0)}</strong></td>
              </tr>
            </table>
          </div>

          <button class="print-button no-print" onclick="window.print()">
            🖨️ Imprimer ce reçu
          </button>

          <div class="footer">
            <p>Merci pour votre confiance • Document généré automatiquement le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 3. Try different approaches for printing
    try {
      // Method 1: Try to open in new window
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        
        // Wait for content to load
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        };
        
        // Fallback if onload doesn't fire
        setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            printWindow.focus();
            printWindow.print();
          }
        }, 1000);
        
        ElMessage.success('Fenêtre d\'impression ouverte');
      } else {
        // Method 2: Fallback - create blob and download
        const blob = new Blob([receiptHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recu_${student.firstname}_${student.lastname}_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        ElMessage.warning('Pop-up bloqué. Le reçu a été téléchargé en tant que fichier HTML.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      ElMessage.error('Erreur lors de l\'ouverture de la fenêtre d\'impression.');
    }

  } catch (error) {
    console.error('Erreur lors de la génération du reçu:', error);
    ElMessage.error('Erreur lors de la génération du reçu de paiement.');
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// La fonction generateMonthlyGrid est déjà définie dans printReceipt - suppression du doublon

const exportToPdf = async () => {
  loadingPdf.value = true;
  try {
    // 1. Récupérer les données
    const result = await window.ipcRenderer.invoke('student:all', {
      page: 1,
      pageSize: totalStudents.value === 0 ? 1000 : totalStudents.value,
      filters: {
        studentFullName: filters.value.studentFullName,
        grade: filters.value.grade
      }
    });

    if (!result.success || !result.data) {
      ElMessage.error("Erreur lors de la récupération des données à exporter.");
      return;
    }

    let allStudents: Student[] = result.data.students;
    await Promise.all(allStudents.map((s: Student) => loadStudentPayments(s.id)));

    // Calculer les dates d'échéance
    for (const student of allStudents) {
        const amounts = paymentAmounts.value.get(student.id);
        if (amounts) {
          amounts.tuitionDueToDate = getTuitionDueToDate(student);
          paymentAmounts.value.set(student.id, amounts);
        }
    }

    // Filtrer par statut si nécessaire
    if (filters.value.paymentStatus) {
      allStudents = allStudents.filter((student: Student) => getPaymentStatus(student.id) === filters.value.paymentStatus);
    }

    if (allStudents.length === 0) {
      ElMessage.warning("Aucune donnée à exporter pour les filtres actuels.");
      return;
    }

    // 2. Créer le PDF avec jsPDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // 3. Ajouter le titre
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Liste des Paiements Étudiants', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

    // 4. Préparer les données du tableau
    const tableData = allStudents.map((student: Student) => {
      const paymentInfo = paymentAmounts.value.get(student.id) || { totalDue: 0, totalPaid: 0, totalRemaining: 0 };
      return [
        student.matricule || '',
        student.lastname || '',
        student.firstname || '',
        student.grade?.name || 'N/A',
        getPaymentStatusLabel(student.id),
        formatCurrencySimple(paymentInfo.totalDue || 0),
        formatCurrencySimple(paymentInfo.totalPaid || 0),
        formatCurrencySimple(paymentInfo.totalRemaining || 0)
      ];
    });

    // 5. Créer le tableau avec autoTable ou fallback manuel
    try {
      autoTable(doc, {
        head: [['Matricule', 'Nom', 'Prénom', 'Classe', 'Statut', 'Total Dû', 'Payé', 'Reste']],
        body: tableData,
        startY: 35,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'left'
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          4: { halign: 'center' }, // Statut
          5: { halign: 'right' },  // Total Dû
          6: { halign: 'right' },  // Payé
          7: { halign: 'right' }   // Reste
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: 35, left: 10, right: 10 },
        didDrawPage: function (data: any) {
          // Pied de page
          const pageCount = doc.getNumberOfPages();
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Page ${data.pageNumber} sur ${pageCount} • Total: ${allStudents.length} étudiant(s)`,
            pageSize.getWidth() / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }
      });
    } catch (autoTableError) {
      console.warn('AutoTable non disponible, utilisation du tableau manuel:', autoTableError);
      
      // Fallback: tableau manuel simple
      const headers = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Statut', 'Total Dû', 'Payé', 'Reste'];
      const colWidths = [25, 30, 30, 25, 20, 25, 25, 25];
      let startX = 15;
      let currentY = 40;
      
      // En-têtes
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((header, i) => {
        doc.text(header, startX, currentY);
        startX += colWidths[i];
      });
      
      currentY += 8;
      
      // Données
      doc.setFont('helvetica', 'normal');
      tableData.forEach((row: string[]) => {
        startX = 15;
        row.forEach((cell, i) => {
          doc.text(cell.toString(), startX, currentY);
          startX += colWidths[i];
        });
        currentY += 6;
        
        // Nouvelle page si nécessaire
        if (currentY > 180) {
          doc.addPage();
          currentY = 20;
        }
      });
      
      // Pied de page simple
      doc.setFontSize(8);
      doc.text(`Total: ${allStudents.length} étudiant(s)`, 15, doc.internal.pageSize.getHeight() - 10);
    }

    // 6. Sauvegarder le PDF
    const filename = `paiements_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    
    ElMessage.success('PDF exporté avec succès !');

  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error);
    ElMessage.error("Erreur lors de l'exportation PDF.");
  } finally {
    loadingPdf.value = false;
  }
};

// Fonction utilitaire pour formater la devise sans symbole complexe
const formatCurrencySimple = (amount: number): string => {
  // Utiliser une approche simple pour éviter les problèmes d'encodage dans le PDF
  const formattedAmount = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return formattedAmount + ' FCFA';
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
    const yearResult = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (yearResult.success) {
      yearRepartition.value = yearResult.data;
    }
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

const getPaymentStatus = (studentId: number): 'paid' | 'partial' | 'unpaid' => {
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts) return 'unpaid';

  if (amounts.totalRemaining <= 0) {
    return 'paid';
  }

  const dueToDate = amounts.tuitionDueToDate;
  if (dueToDate === undefined) {
      if (amounts.paidTuition > 0) return 'partial';
      return 'unpaid';
  }

  if (amounts.paidTuition >= dueToDate) {
      if (amounts.paidTuition > 0) {
          return 'partial';
      } else { 
          return 'unpaid';
      }
  } else {
    return 'unpaid';
  }
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