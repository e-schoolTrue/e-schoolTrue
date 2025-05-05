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
          :data="filteredStudents"
          border
          stripe
          :height="tableHeight"
          highlight-current-row
          empty-text="Aucun étudiant trouvé"
          class="payment-table"
          style="width: 100%"
          :max-height="550"
        >
          <el-table-column type="expand">
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
            width="220"
            sortable
            :sort-method="(a: Student, b: Student) => getPaymentProgress(a.id) - getPaymentProgress(b.id)"
          >
            <template #default="{ row }">
              <div class="payment-progress">
                <el-progress
                  :percentage="getPaymentProgress(row.id)"
                  :status="getProgressStatus(row.id)"
                  :format="(val: number) => `${val}%`"
                  :stroke-width="12"
                  class="payment-progress-bar"
                />
                <div class="progress-details">
                  <currency-display :amount="getPaidAmount(row.id)" class="paid-amount" /> 
                  <span class="separator">/</span> 
                  <currency-display :amount="getAdjustedAnnualAmount(row.id)" class="total-amount" />
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
                  @click="showNewPaymentDialog(row)"
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
import { ElMessage } from "element-plus";
import { Plus, Document, Download, Refresh, Printer, Discount, Money, Wallet, Search, Filter, School } from "@element-plus/icons-vue";
import PaymentDialog from '@/components/payment/PaymentDialog.vue';
import PaymentHistoryDialog from '@/components/payment/PaymentHistory.vue';
import PaymentHistoryMini from '@/components/payment/PaymentHistoryMini.vue';
import printJS from 'print-js';
import * as XLSX from 'xlsx';
import { PaymentConfig, PaymentAmounts } from '@/types/payment';
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
  photo?: {
    path?: string;
    url?: string;
  };
}

interface Grade {
  id: number;
  name: string;
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
            classId: config.classId, // Garder classId comme string
            annualAmount: Number(config.annualAmount)
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
    loading.value = true;
  try {
    console.log('Chargement de tous les étudiants...');
    const result = await window.ipcRenderer.invoke('student:all');
    if (result.success && Array.isArray(result.data)) {
      console.log(`${result.data.length} étudiants récupérés.`);
      students.value = result.data.map((student: any) => {
        // Assurer que les images ont des URLs relatives
        if (student.photo && student.photo.url && student.photo.url.startsWith('file:///')) {
          // Convertir les chemins absolus en chemins relatifs
          student.photo.url = student.photo.url.replace(/^file:\/\/\/C:\/Users\/Briand\/e-schoolTrue\//, '/');
        }
        return student;
      });
      
      // Pour chaque étudiant, charger les paiements
      for (const student of students.value) {
        try {
          if (!student || typeof student.id !== 'number') {
            console.warn('Étudiant invalide, id manquant:', student);
            continue;
          }
          
          console.log(`Traitement des données pour l'étudiant ${student.firstname} ${student.lastname} (ID: ${student.id})`);
          await loadStudentPayments(student.id);
        } catch (studentError) {
          console.error(`Erreur lors du traitement de l'étudiant ${student?.id}:`, studentError);
          // Continuer avec l'étudiant suivant malgré l'erreur
        }
      }
      
      console.log('Chargement des paiements terminé pour tous les étudiants.');
    } else {
      console.error('Erreur lors de la récupération des étudiants:', result.message);
      ElMessage.error('Erreur lors du chargement des étudiants');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des étudiants:', error);
    ElMessage.error('Erreur lors du chargement des données des étudiants');
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

const handlePaymentAdded = async (paymentData: any) => {
  try {
    paymentDialogVisible.value = false;
    console.log('Nouveau paiement ajouté:', paymentData);
    
    // Rafraîchir les données de l'étudiant concerné uniquement
    if (paymentData && paymentData.studentId) {
      console.log(`Actualisation des données pour l'étudiant ID ${paymentData.studentId} après paiement`);
      await loadStudentPayments(paymentData.studentId);
    } else {
      // Si aucun ID d'étudiant n'est fourni, recharger tous les étudiants
      console.log('Aucun ID étudiant fourni, actualisation complète des données');
    await loadStudents();
    }
    
    ElMessage.success('Paiement enregistré avec succès');
  } catch (error) {
    console.error('Erreur lors de la mise à jour après paiement:', error);
    ElMessage.error('Erreur lors de la mise à jour des données');
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
      console.log(`Chargement des données pour l'étudiant ${student.firstname} ${student.lastname} (ID: ${student.id})`);
      
      const [paidResult, configResult] = await Promise.all([
        window.ipcRenderer.invoke("payment:getByStudent", student.id),
        window.ipcRenderer.invoke("payment:getConfig", student.grade?.id)
      ]);

      if (paidResult?.success && configResult?.success) {
        console.log('Résultats obtenus:', { paidResult, configResult });
        
        const baseAmount = configResult.data?.annualAmount || 0;
        const scholarshipPercentage = paidResult.data?.scholarshipPercentage || 0;
        const scholarshipAmount = baseAmount * (scholarshipPercentage / 100);
        const adjustedAmount = baseAmount - scholarshipAmount;
        
        const paidAmount = Array.isArray(paidResult.data?.payments)
          ? paidResult.data.payments.reduce(
              (sum: number, payment: any) => sum + Number(payment.amount || 0),
              0
            )
          : 0;

        // Mettre à jour les données de l'étudiant avec les informations de bourse
        const studentIndex = students.value.findIndex(s => s.id === student.id);
        if (studentIndex !== -1) {
          students.value[studentIndex] = {
            ...student,
            scholarshipPercentage
          };
        }

        paymentAmounts.value.set(student.id, {
          paid: paidAmount,
          remaining: Math.max(0, adjustedAmount - paidAmount),
          studentId: student.id,
          baseAmount,
          scholarshipPercentage,
          scholarshipAmount,
          adjustedAmount
        });
        
        console.log(`Montants mis à jour pour l'étudiant ${student.id}:`, {
          baseAmount,
          scholarshipPercentage,
          scholarshipAmount,
          adjustedAmount,
          paidAmount,
          remaining: Math.max(0, adjustedAmount - paidAmount)
        });
      }
    }
  } catch (error) {
    console.error("Erreur lors du chargement des montants:", error);
    ElMessage.error("Erreur lors du chargement des montants de paiement");
  }
};

const getPaymentProgress = (studentId: number) => {
  const student = students.value.find(s => s.id === studentId);
  if (!student) return 0;
  
  const amounts = paymentAmounts.value.get(studentId);
  if (!amounts) return 0;
  
  const total = amounts.adjustedAmount || getStudentAdjustedAmount(student);
  const paid = amounts.paid || 0;
  
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
  console.log("Calcul du montant total collecté...");
  console.log("Données de paiement disponibles:", Array.from(paymentAmounts.value.entries()));
  
  // Vérifier que paymentAmounts contient des données
  if (paymentAmounts.value.size === 0) {
    console.warn("Aucune donnée de paiement disponible");
    return 0;
  }
  
  let total = 0;
  paymentAmounts.value.forEach((amounts, studentId) => {
    console.log(`Étudiant ID ${studentId}: montant payé = ${amounts.paid}`);
    total += amounts.paid || 0;
  });
  
  console.log("Montant total collecté calculé:", total);
  return total;
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
  // Vérifier d'abord si nous avons déjà les données dans paymentAmounts
  const amounts = paymentAmounts.value.get(studentId);
  if (amounts && amounts.adjustedAmount > 0) {
    return amounts.adjustedAmount;
  }
  
  // Sinon, calculer à la volée
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
    console.log(`Chargement des paiements pour l'étudiant ID ${studentId}...`);
    const result = await window.ipcRenderer.invoke('payment:getByStudent', studentId);
    console.log(`Résultat pour l'étudiant ${studentId}:`, result);

    if (result.success && result.data) {
      // Extraire les données avec des valeurs par défaut pour éviter les erreurs
      const { 
        payments = [], 
        baseAmount = 0, 
        scholarshipPercentage = 0, 
        scholarshipAmount = 0, 
        adjustedAmount = 0
      } = result.data;

      // Vérifier si payments est bien un tableau et le transformer si nécessaire
      const paymentsArray = Array.isArray(payments) ? payments : [];
      
      // Calculer le total payé
      let totalPaid = 0;
      paymentsArray.forEach((payment: any) => {
        if (payment && typeof payment.amount !== 'undefined') {
          totalPaid += Number(payment.amount || 0);
        }
      });
      
      // Définir les nouvelles données
      const newAmounts = {
        paid: totalPaid,
        remaining: Math.max(0, adjustedAmount - totalPaid),
        studentId,
        baseAmount: Number(baseAmount),
        scholarshipPercentage: Number(scholarshipPercentage),
        scholarshipAmount: Number(scholarshipAmount),
        adjustedAmount: Number(adjustedAmount)
      };
      
      console.log(`Montants calculés pour l'étudiant ${studentId}:`, newAmounts);
      paymentAmounts.value.set(studentId, newAmounts);
    } else {
      console.warn(`Échec du chargement des paiements pour l'étudiant ${studentId}:`, result.message || 'Raison inconnue');
      // Initialiser avec des valeurs par défaut
      initializeDefaultPaymentAmounts(studentId);
    }
  } catch (error) {
    console.error(`Erreur lors du chargement des paiements pour l'étudiant ${studentId}:`, error);
    // Initialiser avec des valeurs par défaut en cas d'erreur
    initializeDefaultPaymentAmounts(studentId);
  }
};

// Fonction utilitaire pour initialiser des valeurs par défaut
const initializeDefaultPaymentAmounts = (studentId: number) => {
  paymentAmounts.value.set(studentId, {
    paid: 0,
    remaining: 0,
    studentId,
    baseAmount: 0,
    scholarshipPercentage: 0,
    scholarshipAmount: 0,
    adjustedAmount: 0
  });
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
  if (!student) return null;
  
  const currentYear = new Date().getFullYear().toString();
  console.log(`=== Recherche bourse active pour ${student.firstname} ${student.lastname} ===`);
  console.log('Année courante:', currentYear);
  console.log('Données étudiant:', student);
  
  // Vérifier d'abord dans les montants calculés
  const amounts = paymentAmounts.value.get(student.id);
  if (amounts?.scholarshipPercentage) {
    console.log('Bourse trouvée dans les montants calculés:', amounts.scholarshipPercentage);
    return {
      percentage: amounts.scholarshipPercentage,
      isActive: true,
      schoolYear: currentYear
    };
  }
  
  // Vérifier si la bourse est directement dans l'objet étudiant
  if (student.scholarshipPercentage) {
    console.log('Bourse trouvée dans les données directes:', student.scholarshipPercentage);
    return {
      percentage: student.scholarshipPercentage,
      isActive: true,
      schoolYear: currentYear
    };
  }
  
  // Vérifier dans le tableau des bourses
  if (Array.isArray(student.scholarship)) {
    console.log('Bourses disponibles dans le tableau:', student.scholarship);
    const activeScholarship = student.scholarship.find(s => s.isActive && s.schoolYear === currentYear);
    console.log('Bourse active trouvée dans le tableau:', activeScholarship);
    return activeScholarship;
  }
  
  console.log('Aucune bourse trouvée');
  return null;
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
  overflow: hidden;
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
  overflow-x: auto;
}

.el-table {
  overflow-x: auto;
  max-width: 100%;
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
