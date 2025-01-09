<template>
  <el-container class="professor-payment">
    <!-- En-tête avec statistiques -->
    <el-header class="payment-header">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card shadow="hover" class="stat-card">
            <template #header>
              <div class="stat-header">
                <el-icon><User /></el-icon>
                <span>Total Professeurs</span>
              </div>
            </template>
            <div class="stat-content">
              <span class="stat-value">{{ totalProfessors }}</span>
              <span class="stat-label">professeurs</span>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="12">
          <el-card shadow="hover" class="stat-card primary">
            <template #header>
              <div class="stat-header">
                <el-icon><Money /></el-icon>
                <span>Total Payé</span>
              </div>
            </template>
            <div class="stat-content">
              <currency-display :amount="totalPaid" />
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
                v-model="filters.professorName"
                placeholder="Rechercher un professeur..."
                prefix-icon="Search"
                clearable
                @input="handleFilter"
              />
              
              <el-date-picker
                v-model="filters.month"
                type="month"
                placeholder="Sélectionner le mois"
                format="MMMM YYYY"
                value-format="YYYY-MM"
                @change="handleFilter"
              />
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
                  :icon="Plus"
                  @click="showNewPaymentDialog"
                >
                  Nouveau Paiement
                </el-button>
                <el-button
                  type="info"
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

        <!-- Table simplifiée -->
        <el-table
          v-loading="loading"
          :data="filteredPayments"
          border
          stripe
        >
          <el-table-column 
            label="Professeur" 
            min-width="250"
          >
            <template #default="{ row }">
              <div class="professor-info">
                <el-avatar :size="32">
                  {{ getInitials(row.professor) }}
                </el-avatar>
                <div class="professor-details">
                  <span>{{ row.professor.firstname }} {{ row.professor.lastname }}</span>
                  <small>{{ getTeachingInfo(row.professor) }}</small>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            label="Type"
            prop="type"
            width="150"
          >
            <template #default="{ row }">
              <el-tag :type="getPaymentTypeColor(row.type)">
                {{ formatPaymentType(row.type) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label="Montant"
            prop="amount"
            width="150"
            align="right"
          >
            <template #default="{ row }">
              <currency-display :amount="row.amount" />
            </template>
          </el-table-column>

          <el-table-column
            label="Mode"
            prop="paymentMethod"
            width="120"
          >
            <template #default="{ row }">
              {{ formatPaymentMethod(row.paymentMethod) }}
            </template>
          </el-table-column>

          <el-table-column
            label="Date"
            prop="createdAt"
            width="120"
          >
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>

          <el-table-column
            label="Actions"
            width="120"
            fixed="right"
            align="center"
          >
            <template #default="{ row }">
              <el-button-group>
                <el-button
                  type="primary"
                  circle
                  size="small"
                  :icon="Printer"
                  @click="printPayslip(row)"
                />
                <el-button
                  type="warning"
                  circle
                  size="small"
                  :icon="Edit"
                  @click="editPayment(row)"
                />
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-main>

    <!-- Dialog pour les paiements -->
    <professor-payment-dialog
      v-model:visible="paymentDialogVisible"
      :professor="selectedProfessor"
      :payment="selectedPayment"
      @payment-added="handlePaymentAdded"
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Download, Printer, Edit, Money, User, Refresh } from '@element-plus/icons-vue';
import ProfessorPaymentDialog from '@/components/professor/ProfessorPaymentDialog.vue';
import * as XLSX from 'xlsx';
import printJS from 'print-js';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';

interface Teaching {
  class?: {
    name: string;
  };
  course?: {
    name: string;
  };
}

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
  subject?: string;
  teaching?: Teaching[];
}

interface Payment {
  id: number;
  professor: {
    id: number;
    firstname: string;
    lastname: string;
    subject?: string;
    teaching?: Array<{
      class?: { name: string };
      course?: { name: string };
    }>;
    qualification?: { name: string };
  };
  amount: number;
  type: string;
  paymentMethod: string;
  month: string;
  createdAt: string;
  isPaid: boolean;
  reference?: string;
  comment?: string;
  grossAmount: number;
  netAmount: number;
  deductions?: Array<{
    name: string;
    amount: number;
    description?: string;
  }>;
}

interface Filters {
  professorName: string;
  month?: string;
  paymentStatus?: 'paid' | 'pending';
}

// États
const loading = ref(false);
const totalProfessors = ref(0);
const totalPaid = ref(0);
const totalPending = ref(0);
const payments = ref<Payment[]>([]);
const filteredPayments = ref<Payment[]>([]);
const paymentDialogVisible = ref(false);
const selectedProfessor = ref<Professor | undefined>(undefined);
const selectedPayment = ref<Payment | undefined>(undefined);

const filters = ref<Filters>({
  professorName: '',
  month: undefined,
  paymentStatus: undefined
});

// Formatage

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const getPaymentTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    salary: 'primary',
    bonus: 'success',
    overtime: 'warning'
  };
  return colors[type] || 'info';
};

const formatPaymentType = (type: string): string => {
  const types: Record<string, string> = {
    salary: 'Salaire',
    bonus: 'Prime',
    overtime: 'Heures sup.'
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

const getInitials = (professor: Professor): string => {
  return `${professor.firstname[0]}${professor.lastname[0]}`.toUpperCase();
};

const getTeachingInfo = (professor: Professor): string => {
  if (professor.subject) return professor.subject;
  if (professor.teaching && professor.teaching.length > 0) {
    const teaching = professor.teaching[0];
    return teaching.class?.name || teaching.course?.name || 'N/A';
  }
  return 'N/A';
};

// Chargement des données
const loadData = async () => {
  loading.value = true;
  try {
    // Charger le nombre total de professeurs
    const professorCountResult = await window.ipcRenderer.invoke('professor:count');
    if (professorCountResult?.success) {
      totalProfessors.value = Number(professorCountResult.data) || 0;
    }

    // Charger les paiements et les statistiques
    const [statsResult, paymentsResult] = await Promise.all([
      window.ipcRenderer.invoke('professor:payments:stats'),
      window.ipcRenderer.invoke('professor:payments:list', {
        month: filters.value.month,
        status: filters.value.paymentStatus
      })
    ]);

    if (statsResult?.success && statsResult.data) {
      totalPaid.value = Number(statsResult.data.totalPaid) || 0;
      totalPending.value = Number(statsResult.data.totalPending) || 0;
    }

    if (paymentsResult?.success && paymentsResult.data) {
      payments.value = Array.isArray(paymentsResult.data) 
        ? paymentsResult.data.map((p: { paymentType: any; type: any; }) => ({
            ...p,
            type: p.paymentType || p.type // Gère les deux cas possibles
          }))
        : [];
      filteredPayments.value = [...payments.value];
      handleFilter();
    }
  } catch (error) {
    console.error('Erreur détaillée lors du chargement des données:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

// Ajoutez une fonction de rafraîchissement
const refreshData = async () => {
  await loadData();
};

// Filtrage
const handleFilter = () => {
  filteredPayments.value = payments.value.filter(payment => {
    const nameMatch = filters.value.professorName
      ? payment.professor.firstname.toLowerCase().includes(filters.value.professorName.toLowerCase()) ||
        payment.professor.lastname.toLowerCase().includes(filters.value.professorName.toLowerCase())
      : true;

    const monthMatch = filters.value.month
      ? payment.month === filters.value.month
      : true;

    const statusMatch = filters.value.paymentStatus
      ? (payment.isPaid ? 'paid' : 'pending') === filters.value.paymentStatus
      : true;

    return nameMatch && monthMatch && statusMatch;
  });
};

// Actions
const showNewPaymentDialog = () => {
  selectedPayment.value = undefined;
  selectedProfessor.value = undefined;
  paymentDialogVisible.value = true;
};

const editPayment = (payment: Payment) => {
  selectedPayment.value = payment;
  selectedProfessor.value = payment.professor;
  paymentDialogVisible.value = true;
};


const handlePaymentAdded = () => {
  paymentDialogVisible.value = false;
  loadData();
};

// Export Excel
const exportToExcel = async () => {
  try {
    loading.value = true;
    const exportData = filteredPayments.value.map(payment => ({
      'Professeur': `${payment.professor.firstname} ${payment.professor.lastname}`,
      'Matière': payment.professor.subject || 'N/A',
      'Type': formatPaymentType(payment.type),
      'Montant': payment.amount,
      'Mode': formatPaymentMethod(payment.paymentMethod),
      'Mois': new Date(payment.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      'Date': formatDate(payment.createdAt),
      'Statut': payment.isPaid ? 'Payé' : 'En attente'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajuster la largeur des colonnes
    const colWidths = [
      { wch: 25 }, // Professeur
      { wch: 15 }, // Matière
      { wch: 15 }, // Type
      { wch: 15 }, // Montant
      { wch: 15 }, // Mode
      { wch: 15 }, // Mois
      { wch: 15 }, // Date
      { wch: 12 }  // Statut
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
    XLSX.writeFile(wb, `paiements_professeurs_${new Date().toISOString().split('T')[0]}.xlsx`);

    ElMessage.success('Export Excel réussi');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    ElMessage.error('Erreur lors de l\'export Excel');
  } finally {
    loading.value = false;
  }
};

// Impression fiche de paie
const printPayslip = async (paymentDetails: any) => {
  try {
    const schoolInfo = await window.ipcRenderer.invoke('school:get');
    if (!schoolInfo?.success) {
      throw new Error('Impossible de récupérer les informations de l\'école');
    }

    const schoolData = schoolInfo.data;
    const { currency } = useCurrency();

    const content = `
      <div class="payslip-container" style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="width: 50%; border: 1px solid black; padding: 10px;">
              KAYA<br>
              ${schoolData.town}<br>
              Bangui<br>
              Tel: ${schoolData.phone}<br>
              Email: ${schoolData.email}
            </td>
            <td style="width: 50%; border: 1px solid black; padding: 10px;">
              BULLETIN DE PAIE<br>
              Période: ${new Date(paymentDetails.month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}<br>
              N° Bulletin: ${paymentDetails.id}<br>
              Date d'émission: ${new Date(paymentDetails.createdAt).toLocaleDateString('fr-FR')}
            </td>
          </tr>
        </table>

        <div style="margin-bottom: 20px;">
          ${paymentDetails.professor.firstname} ${paymentDetails.professor.lastname}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border: 1px solid black;">
            <th style="border: 1px solid black; padding: 5px;">RUBRIQUES</th>
            <th style="border: 1px solid black; padding: 5px;">BASE</th>
            <th style="border: 1px solid black; padding: 5px;">TAUX</th>
            <th style="border: 1px solid black; padding: 5px;">MONTANT</th>
          </tr>
          <tr style="border: 1px solid black;">
            <td style="border: 1px solid black; padding: 5px;">Salaire de base</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${new Intl.NumberFormat('fr-FR').format(paymentDetails.grossAmount)} ${currency.value}</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">100%</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${new Intl.NumberFormat('fr-FR').format(paymentDetails.grossAmount)} ${currency.value}</td>
          </tr>
          ${paymentDetails.deductions?.map((d: { name: string; amount: number; }) => `
            <tr style="border: 1px solid black;">
              <td style="border: 1px solid black; padding: 5px;">${d.name}</td>
              <td style="border: 1px solid black; padding: 5px; text-align: right;"></td>
              <td style="border: 1px solid black; padding: 5px; text-align: right;"></td>
              <td style="border: 1px solid black; padding: 5px; text-align: right;">${new Intl.NumberFormat('fr-FR').format(d.amount)} ${currency.value}</td>
            </tr>
          `).join('') || ''}
          <tr style="border: 1px solid black;">
            <td colspan="3" style="border: 1px solid black; padding: 5px;">TOTAL DES RETENUES</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${new Intl.NumberFormat('fr-FR').format(paymentDetails.deductions?.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0) || 0)} ${currency.value}</td>
          </tr>
          <tr style="border: 1px solid black;">
            <td colspan="3" style="border: 1px solid black; padding: 5px;">NET A PAYER</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${new Intl.NumberFormat('fr-FR').format(paymentDetails.netAmount)} ${currency.value}</td>
          </tr>
        </table>

        <div style="margin-top: 40px; text-align: center;">
          Fait à ${schoolData.town}, le ${new Date(paymentDetails.createdAt).toLocaleDateString('fr-FR')}
        </div>

        <div style="margin-top: 60px; display: flex; justify-content: space-between;">
          <div>L'employé</div>
          <div>L'employeur</div>
        </div>
      </div>
    `;

    printJS({
      printable: content,
      type: 'raw-html',
      documentTitle: `Bulletin de paie - ${paymentDetails.professor.firstname} ${paymentDetails.professor.lastname}`,
      targetStyles: ['*']
    });

  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    ElMessage.error('Erreur lors de l\'impression du bulletin');
  }
};

// Initialisation
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.professor-payment {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.payment-header {
  padding: 20px;
  height: auto;
  flex-shrink: 0;
}

.payment-content {
  flex: 1;
  overflow: auto;
  padding: 0 20px 20px;
}

.stats-header {
  margin-bottom: 20px;
}

.stat-card {
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 24px;
  padding: 15px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
}

.stat-label {
  color: var(--el-text-color-secondary);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 20px;
}

.search-filters {
  display: flex;
  gap: 10px;
  flex: 1;
}

.professor-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.professor-details {
  display: flex;
  flex-direction: column;
}

.professor-details small {
  color: var(--el-text-color-secondary);
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
  }
  
  .search-filters {
    flex-direction: column;
  }
}

.payment-progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.progress-details {
  color: var(--el-text-color-secondary);
  text-align: center;
  font-size: 12px;
}

@media print {
  .el-button,
  .el-dialog__wrapper {
    display: none !important;
  }
}
</style> 