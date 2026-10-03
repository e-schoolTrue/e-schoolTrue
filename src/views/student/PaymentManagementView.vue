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

              <!-- Année de travail : celle du `YearSwitcher` du menu (store) — AUCUNE UI année ici. -->
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
                <el-tooltip content="Imprimer un reçu CASY" placement="top">
                <el-button
                  type="success"
                  size="small"
                  @click="printReceiptCasy(row)"
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
import autoTable from 'jspdf-autotable';
import { PaymentConfig } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';
import { amountInWordsFR } from '@/utils/amountInWordsFR';
import {
  buildCasyMonthlyGrid,
  buildCasyReceiptHtml,
  buildCasyTranchesFallback,
  dateEnLettres,
  defaultEcheanceISO,
  formatJJMMAAAA,
  markTranchesPaid,
  maskRef,
  openCasyPrintWindow,
} from '@/utils/receiptCasy';
import { PaymentAnnualConfig } from "@/types/payment";
import { YearRepartition } from "@/types/year";
import { useYearStore } from "@/stores/yearStore";
import { useRouter } from "vue-router";
import { isNoSecretError, mapAccountingError, openGuardedForm } from "@/composables/useAccountingGuard";

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  schoolYear?: string;
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
  /** Année scolaire — filtre serveur (`student:all`) + repli client. */
  schoolYear?: string;
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
const trancheConfigs = ref(new Map<number, PaymentAnnualConfig>());
const yearRepartition = ref<YearRepartition | null>(null);
const filters = ref<Filters>({
  studentFullName: "",
  grade: undefined,
  paymentStatus: undefined,
  schoolYear: undefined,
});

/** Année du menu (`YearSwitcher`) : `yearStore.fetchList()` en interne (warm store
 * uniquement), valeur silencieuse dans `filters.schoolYear` — AUCUNE UI année ici. */
const loadSchoolYears = async () => {
  try {
    const yearStore = useYearStore();
    if (yearStore.list.length === 0) await yearStore.fetchList();
    // Verrou : l'année du menu fait foi, repli serveur — jamais de switch utilisateur.
    const current = yearStore.currentSchoolYear || (await yearStore.fetchCurrent().catch(() => null))?.schoolYear;
    if (current) filters.value.schoolYear = current;
  } catch {
    /* fail-open : valeur conservée */
  }
};

const { formatCurrency, currency } = useCurrency();
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
      const newTrancheConfigs = new Map<number, PaymentAnnualConfig>();
      result.data.forEach((config: PaymentAnnualConfig) => {
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
// @ts-ignore
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
        grade: filters.value.grade,
        schoolYear: filters.value.schoolYear,
      }
    });
    
    // P0 FIX: tolerant to both array and {students,total} shapes
    if (result.success !== false && result.data !== undefined && result.data !== null) {
      const payload = Array.isArray(result.data) ? { students: result.data, total: result.data.length } : result.data;
      const fetched: Student[] = payload.students ?? [];
      // Repli client : le backend ignore `schoolYear` — on filtre ici.
      students.value = filters.value.schoolYear
        ? fetched.filter((s) => (s.schoolYear || '') === filters.value.schoolYear)
        : fetched;
      totalStudents.value = payload.total ?? payload.students?.length ?? 0;

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

const openPaymentDialog = async (student: Student) => {
  // Garde d'OUVERTURE : popup AVANT l'ouverture du PaymentDialog.
  // Annuler/NO_SECRET_SET -> ne pas ouvrir. Double garde au submit conservée (PaymentDialog).
  try {
    await openGuardedForm(() => {
      selectedStudent.value = student;
      paymentDialogVisible.value = true;
    });
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err));
      void router.push('/comptabilite/setup');
    }
  }
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
        grade: filters.value.grade,
        schoolYear: filters.value.schoolYear,
      }
    });

    // P0 FIX: tolerant to both shapes
    if (result.success === false || result.data === undefined || result.data === null) {
      ElMessage.error("Erreur lors de la récupération des données à exporter.");
      return;
    }

    let allStudents: Student[] = Array.isArray(result.data) ? result.data : (result.data.students ?? []);
    // Repli client (backend sans filtre `schoolYear`).
    if (filters.value.schoolYear) {
      allStudents = allStudents.filter((s) => (s.schoolYear || '') === filters.value.schoolYear);
    }

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

/**
 * Impression reçu maquette CASY — factorisée (`@/utils/receiptCasy`).
 * Même HTML que `ReceiptTemplate.vue` : 2 colonnes mensuel/tranches côte-à-côte,
 * barcode, totaux, mention E-School. Fallbacks si photo/tél/sexe absents.
 */
const printReceiptCasy = async (student: Student) => {
  if (!student) {
    ElMessage.error("Aucun étudiant sélectionné pour l'impression.");
    return;
  }
  try {
    const invoke = window.ipcRenderer.invoke.bind(window.ipcRenderer);
    const unwrap = (res: unknown): unknown => {
      if (res && typeof res === 'object' && 'success' in (res as Record<string, unknown>)) {
        const r = res as { success?: boolean; data?: unknown };
        return r.success ? r.data : null;
      }
      return res;
    };
    const [payRaw, schoolRaw] = await Promise.all([
      invoke('payment:getByStudent', student.id).catch(() => null),
      invoke('school:get').catch(() => null),
    ]);
    const payData = (unwrap(payRaw) ?? {}) as {
      inscriptionFeeDue?: number; tuitionFeeDue?: number; adjustedTuitionFee?: number;
      scholarshipAmount?: number; totalDue?: number; totalPaid?: number; totalRemaining?: number;
      paidTuition?: number; paidInscriptionFee?: number; payments?: Array<{ amount?: number; created_at?: string; paymentType?: string }>;
    };
    const schoolInfo = ((unwrap(schoolRaw) ?? {}) as Record<string, unknown>) ?? {};
    let logoBase64 = '';
    const logoId = (schoolInfo.logo as { id?: number } | undefined)?.id;
    if (logoId) {
      try {
        const logoRes = (unwrap(await invoke('school:getLogo', logoId).catch(() => null)) ?? {}) as { type?: string; content?: string };
        if (logoRes.content) logoBase64 = `data:${logoRes.type ?? 'image/png'};base64,${logoRes.content}`;
      } catch { /* logo optionnel */ }
    }
    // Photo élève (optionnelle — même canal que StudentDetailsView).
    let photoBase64 = '';
    const photoId = ((student as unknown as { photo?: { id?: number; url?: string } }).photo)?.id;
    const photoUrl = ((student as unknown as { photo?: { url?: string } }).photo)?.url;
    if (photoUrl && photoUrl.startsWith('data:')) photoBase64 = photoUrl;
    else if (photoId != null) {
      try {
        const pres = (unwrap(await invoke('getStudentPhoto', photoId).catch(() => null)) ?? {}) as { type?: string; content?: string };
        if ((pres as { content?: string }).content) photoBase64 = `data:${pres.type ?? 'image/jpeg'};base64,${pres.content}`;
      } catch { /* photo optionnelle */ }
    }
    // Détails élève (sexe, tél) — best effort.
    let sexe = '—';
    let telephone = '—';
    try {
      const det = (unwrap(await invoke('student:getDetails', Number(student.id)).catch(() => null)) ?? {}) as Record<string, unknown>;
      const sx = String((det.sex ?? det.sexe ?? '') as string).toLowerCase();
      if (['male', 'm', 'masculin'].includes(sx)) sexe = 'Masculin';
      else if (['female', 'f', 'feminin', 'féminin'].includes(sx)) sexe = 'Féminin';
      telephone = String((det.famillyPhone ?? det.personalPhone ?? '') as string) || '—';
    } catch { /* optionnel */ }
    const inscription = Number(payData.inscriptionFeeDue ?? 0);
    const coutAnnuel = Number(payData.tuitionFeeDue ?? 0);
    const rabais = Number(payData.scholarshipAmount ?? 0);
    const net = Number(payData.totalDue ?? (inscription + Number(payData.adjustedTuitionFee ?? (coutAnnuel - rabais))));
    const totalPaye = Number(payData.totalPaid ?? 0);
    const solde = Number(payData.totalRemaining ?? Math.max(0, net - totalPaye));
    const paidTuition = Number(payData.paidTuition ?? 0);
    const monthly = buildCasyMonthlyGrid(coutAnnuel, paidTuition);
    let tranches = buildCasyTranchesFallback(coutAnnuel, paidTuition);
    try {
      const trancheRaw = (unwrap(await invoke('tranche-config:all').catch(() => null)) ?? []) as Array<{ grade?: { id?: number }; tranches?: Array<{ name?: string; tranchName?: string; amount?: number }> }>;
      const mine = Array.isArray(trancheRaw) ? trancheRaw.find((c) => Number(c?.grade?.id) === Number(student.grade?.id)) : undefined;
      if (mine?.tranches?.length) {
        tranches = markTranchesPaid(mine.tranches.map((t, i) => ({ nom: String(t?.name ?? t?.tranchName ?? `Tranche ${i + 1}`), montant: Number(t?.amount ?? 0) })), paidTuition);
      }
    } catch { /* tranches repli déjà calculées */ }
    const fmt = (n: unknown): string => {
      try { return formatCurrency(Number(n ?? 0)); } catch { return `${Number(n ?? 0)} ${currency.value}`; }
    };
    const now = new Date();
    const numero = `R-${now.getFullYear()}-${String(student.id).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
    const html = buildCasyReceiptHtml({
      schoolName: String(schoolInfo.name ?? 'COMPLEXE SCOLAIRE'),
      schoolTels: String(schoolInfo.phone ?? '—'),
      schoolEmail: String(schoolInfo.email ?? '—'),
      schoolYear: String((student.schoolYear ?? schoolInfo.schoolYear ?? '') || '—'),
      logo: logoBase64 || undefined,
      numero,
      maskedRef: maskRef(''),
      dateJJMMAAAA: now.toLocaleDateString('fr-FR'),
      dateLettres: dateEnLettres(now.toISOString()),
      matricule: String(student.matricule ?? '—'),
      prenomsNom: `${student.firstname ?? ''} ${student.lastname ?? ''}`.trim() || '—',
      sexe,
      telephone,
      classe: String(student.grade?.name ?? '—'),
      motif: 'Scolarité',
      mode: 'Espèces',
      montantJour: fmt(totalPaye),
      montantDigits: fmt(totalPaye),
      montantLettres: amountInWordsFR(totalPaye, currency.value),
      monthly,
      monthlyCells: monthly.map((m) => fmt(m.montant)),
      tranches,
      trancheCells: tranches.map((t) => fmt(t.montant)),
      annuel: fmt(coutAnnuel),
      prochainPaiement: solde <= 0 ? 'Soldé' : formatJJMMAAAA(defaultEcheanceISO(now)),
      totaux: { inscription: fmt(inscription), coutAnnuel: fmt(coutAnnuel), rabais: fmt(rabais), net: fmt(net), totalPaye: fmt(totalPaye), solde: fmt(solde) },
      barcodeValue: numero,
      caissier: '—',
      photo: photoBase64 || undefined,
    }, { title: `Reçu de paiement - ${student.firstname} ${student.lastname}` });
    const opened = openCasyPrintWindow(html, `recu_${student.firstname}_${student.lastname}_${now.toISOString().slice(0, 10)}.html`);
    if (opened) ElMessage.success("Fenêtre d'impression ouverte");
    else ElMessage.warning('Pop-up bloquée. Le reçu a été téléchargé en tant que fichier HTML.');
  } catch (error) {
    console.error('Erreur lors de la génération du reçu CASY:', error);
    ElMessage.error('Erreur lors de la génération du reçu de paiement.');
  }
};

/** Compatibilité historique : l'ancien `printReceipt` pointait vers la maquette CASY factorisée. */
const printReceipt = printReceiptCasy;
void printReceipt;

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

    // P0 FIX: tolerant to both shapes
    if (result.success === false || result.data === undefined || result.data === null) {
      ElMessage.error("Erreur lors de la récupération des données à exporter.");
      return;
    }

    let allStudents: Student[] = Array.isArray(result.data) ? result.data : (result.data.students ?? []);
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
  return `${formattedAmount} ${currency.value}`;
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
    await loadSchoolYears();
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
  const { totalRemaining, totalPaid } = amounts;
  if (totalRemaining <= 0) return 'paid';
  if (totalPaid > 0) return 'partial';
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