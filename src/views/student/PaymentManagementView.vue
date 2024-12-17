<template>
  <el-container class="payment-management">
    <el-header class="payment-header">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="stat-card" shadow="hover">
            <template #header>
              <div class="stat-header">
                <el-icon><User /></el-icon>
                <span>Total Élèves</span>
              </div>
            </template>
            <div class="stat-content">
              <span class="stat-value">{{ totalStudents }}</span>
              <span class="stat-label">élèves</span>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="stat-card success" shadow="hover">
            <template #header>
              <div class="stat-header">
                <el-icon><Money /></el-icon>
                <span>Montant Collecté</span>
              </div>
            </template>
            <div class="stat-content">
              <span class="stat-value">{{ formatAmount(getTotalCollectedAmount()) }}</span>
              <span class="stat-label">FCFA</span>
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
              <span class="stat-value">{{ formatAmount(getTotalRemainingAmount()) }}</span>
              <span class="stat-label">FCFA</span>
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

          <!-- ... autres colonnes existantes ... -->

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
                  {{ formatAmount(getPaidAmount(row.id)) }} / 
                  {{ formatAmount(getAnnualAmount(row.grade?.id)) }} FCFA
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
import { Plus, Document, Download, Refresh, Printer } from "@element-plus/icons-vue";
import PaymentDialog from '@/components/payment/PaymentDialog.vue';
import PaymentHistoryDialog from '@/components/payment/PaymentHistory.vue';
import printJS from 'print-js';
import * as XLSX from 'xlsx';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  grade: {
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
}

interface Grade {
  id: number;
  name: string;
}

interface PaymentConfig {
  classId: number;
  className: string;
  annualAmount: number;
  installments: number;
}

interface PaymentAmounts {
  paid: number;
  remaining: number;
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
const selectedStudent = ref<Student | null>(null);
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

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat("fr-FR").format(amount);
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
  if (!student) {
    console.warn("Étudiant non défini");
    return null;
  }

  if (!student.grade?.id) {
    console.warn("Grade non défini pour l'étudiant:", student);
    return null;
  }

  const config = classConfigs.value.get(student.grade.id);
  console.log("Configuration trouvée:", config);

  if (!config) {
    console.warn(`Aucune configuration trouvée pour la classe ${student.grade.name}`);
    return null;
  }

  return {
    ...config,
    className: student.grade.name
  };
};

const loadStudents = async () => {
  loading.value = true;
  try {
    const queryParams = {
      page: currentPage.value,
      limit: pageSize.value,
      ...filters.value,
    };

    const result = await window.ipcRenderer.invoke("student:all", queryParams);

    if (result?.success && Array.isArray(result.data)) {
      students.value = result.data;
      totalStudents.value = result.total || students.value.length;
      // Charger les montants immédiatement après avoir chargé les étudiants
      await loadStudentAmounts();
    }
    filteredStudents.value = students.value;
  } catch (error) {
    console.error("Erreur lors du chargement des étudiants:", error);
    ElMessage.error("Erreur lors du chargement des étudiants");
    students.value = [];
    totalStudents.value = 0;
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
  filteredStudents.value = students.value.filter((student) => {
    // Filtre par nom/prénom
    const nameMatch = filters.value.studentFullName
      ? student.firstname.toLowerCase().includes(filters.value.studentFullName.toLowerCase()) ||
        student.lastname.toLowerCase().includes(filters.value.studentFullName.toLowerCase())
      : true;

    // Filtre par classe
    const gradeMatch = filters.value.grade
      ? student.grade?.id === filters.value.grade
      : true;

    // Filtre par statut de paiement
    const paymentStatus = filters.value.paymentStatus
      ? getPaymentStatus(student.id) === filters.value.paymentStatus
      : true;

    return nameMatch && gradeMatch && paymentStatus;
  });
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
  paymentDialogVisible.value = false;
  loading.value = true;
  
  try {
    // Recharger les données
    await loadStudents();
    await loadPaymentConfigs();
    await loadStudentAmounts();
    
    ElMessage.success("Paiement ajouté avec succès");
  } catch (error) {
    console.error('Erreur lors du rechargement des données:', error);
    ElMessage.error("Erreur lors de la mise à jour des données");
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

const refreshData = () => {
  loadStudentAmounts;
  loadStudents();
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
          remaining: Math.max(0, annualAmount - paidAmount)
        });
      }
    }
    
    console.log('Montants mis à jour:', Array.from(paymentAmounts.value.entries()));
  } catch (error) {
    console.error("Erreur lors du chargement des montants:", error);
    ElMessage.error("Erreur lors du chargement des montants de paiement");
  }
};

const getPaymentProgress = (studentId: number): number => {
  const student = students.value.find((s) => s.id === studentId);
  if (!student?.grade?.id) return 0;

  const annualAmount = getAnnualAmount(student.grade.id);
  if (annualAmount === 0) return 0;

  const paidAmount = getPaidAmount(studentId);
  return Math.round((paidAmount / annualAmount) * 100);
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
  return Array.from(paymentAmounts.value.values()).reduce(
    (sum, amounts) => sum + amounts.remaining,
    0
  );
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

const getPaymentStatusType = (studentId: number): string => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return 'success';
  if (progress >= 50) return 'warning';
  return 'danger';
};

const getPaymentStatusLabel = (studentId: number): string => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return 'Payé';
  if (progress >= 50) return 'En cours';
  return 'En retard';
};

const getPaymentStatus = (studentId: number): 'paid' | 'late' | 'unpaid' => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return 'paid';
  if (progress >= 50) return 'late';
  return 'unpaid';
};

const printReceipt = async (student: Student) => {
  try {
    const schoolInfo = await window.ipcRenderer.invoke('school:get');
    const paymentsResult = await window.ipcRenderer.invoke('payment:getByStudent', student.id);
    
    if (!paymentsResult?.success) {
      throw new Error('Erreur lors de la récupération des paiements');
    }

    const payments = paymentsResult.data;
    if (!payments.length) {
      ElMessage.warning('Aucun paiement trouvé pour cet étudiant');
      return;
    }

    // Calculer le total des paiements
    const totalAmount = payments.reduce((sum: number, p: { amount: any; }) => sum + Number(p.amount), 0);

    const content = `
      <div class="receipt-container" style="padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${schoolInfo?.data?.logo ? `<img src="data:${schoolInfo.data.logo.type};base64,${schoolInfo.data.logo.content}" style="max-height: 100px; margin-bottom: 10px;">` : ''}
          <h2>${schoolInfo?.data?.name || 'École'}</h2>
          <h3>État des Paiements</h3>
          <p style="margin: 5px 0;">Date d'impression: ${formatDate(new Date().toISOString())}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px;"><strong>Élève:</strong></td>
              <td style="padding: 5px;">${student.firstname} ${student.lastname}</td>
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
        
        <div style="margin-bottom: 20px;">
          <h4 style="margin-bottom: 10px;">Historique des paiements</h4>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background-color: #f5f7fa;">
                <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Type</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Mode</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((payment: { createdAt: string; paymentType: string; paymentMethod: string; amount: number; }) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(payment.createdAt)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${formatPaymentType(payment.paymentType)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${formatPaymentMethod(payment.paymentMethod)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatAmount(payment.amount)} FCFA</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f5f7fa;">
                <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">Total payé</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatAmount(totalAmount)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: flex-end;">
          <div>
            <p style="margin-bottom: 40px;">Signature et cachet:</p>
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
      documentTitle: `État des paiements - ${student.firstname} ${student.lastname}`,
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

    ElMessage.success('État des paiements généré avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    ElMessage.error('Erreur lors de l\'impression');
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
</style>
