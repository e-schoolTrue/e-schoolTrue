<template>
  <el-dialog
    v-model="dialogVisible"
    title="Bordereau de paiement journalier"
    width="900px"
    @close="handleClose"
  >
    <div class="daily-payment-report">
      <!-- Sélection de la date -->
      <div class="date-selector">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="Sélectionner une date"
          format="DD/MM/YYYY"
          value-format="YYYY-MM-DD"
          @change="loadDailyPayments"
        />
        <el-button 
          type="primary" 
          @click="loadDailyPayments"
          :disabled="!selectedDate"
        >
          <el-icon><Search /></el-icon>
          Rechercher
        </el-button>
        <el-button 
          type="success" 
          @click="printDailyReport"
          :disabled="!dailyPayments.length"
        >
          <el-icon><Printer /></el-icon>
          Imprimer le bordereau
        </el-button>
      </div>

      <!-- Résumé du jour -->
      <div class="daily-summary" v-if="dailyPayments.length > 0">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-statistic
              title="Total du jour"
              :value="totalAmount"
              :formatter="formatCurrency"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="Nombre de paiements"
              :value="dailyPayments.length"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="Frais d'inscription"
              :value="totalInscription"
              :formatter="formatCurrency"
            />
          </el-col>
          <el-col :span="6">
            <el-statistic
              title="Frais de scolarité"
              :value="totalTuition"
              :formatter="formatCurrency"
            />
          </el-col>
        </el-row>
      </div>

      <!-- Tableau des paiements -->
      <el-table
        v-loading="loading"
        :data="dailyPayments"
        border
        stripe
        show-summary
        :summary-method="getSummaries"
        style="width: 100%; margin-top: 20px;"
        max-height="400"
      >
        <el-table-column
          type="index"
          label="N°"
          width="50"
          align="center"
        />
        
        <el-table-column
          prop="created_at"
          label="Heure"
          width="80"
        >
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column
          prop="student"
          label="Élève"
          min-width="200"
        >
          <template #default="{ row }">
            <div>
              <strong>{{ row.student?.firstname }} {{ row.student?.lastname }}</strong>
              <div style="font-size: 12px; color: #909399;">
                {{ row.student?.matricule }} - {{ row.student?.grade?.name }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="paymentType"
          label="Type"
          width="120"
        >
          <template #default="{ row }">
            <el-tag :type="row.paymentType === 'inscription' ? 'success' : 'primary'">
              {{ row.paymentType === 'inscription' ? 'Inscription' : 'Scolarité' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="amount"
          label="Montant"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            {{ formatCurrency(row.amount) }}
          </template>
        </el-table-column>

        <el-table-column
          prop="paymentMethod"
          label="Mode"
          width="100"
        >
          <template #default="{ row }">
            {{ formatPaymentMethod(row.paymentMethod) }}
          </template>
        </el-table-column>

        <el-table-column
          prop="reference"
          label="Référence"
          width="120"
          show-overflow-tooltip
        />
      </el-table>

      <!-- Message si pas de paiements -->
      <el-empty 
        v-if="!loading && dailyPayments.length === 0 && selectedDate"
        description="Aucun paiement enregistré pour cette date"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, Printer } from '@element-plus/icons-vue';
import { useCurrency } from '@/composables/useCurrency';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible']);

const { formatCurrency } = useCurrency();
const loading = ref(false);
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const dailyPayments = ref<any[]>([]);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const totalAmount = computed(() => 
  dailyPayments.value.reduce((sum, p) => sum + Number(p.amount), 0)
);

const totalInscription = computed(() => 
  dailyPayments.value
    .filter(p => p.paymentType === 'inscription')
    .reduce((sum, p) => sum + Number(p.amount), 0)
);

const totalTuition = computed(() => 
  dailyPayments.value
    .filter(p => p.paymentType !== 'inscription')
    .reduce((sum, p) => sum + Number(p.amount), 0)
);

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatPaymentMethod = (method: string) => {
  const methods: Record<string, string> = {
    cash: 'Espèces',
    check: 'Chèque',
    transfer: 'Virement',
    mobile_money: 'Mobile'
  };
  return methods[method] || method;
};

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  
  columns.forEach((column: any, index: number) => {
    if (index === 0) {
      sums[index] = 'Total';
      return;
    }
    if (column.property === 'amount') {
      const values = data.map((item: any) => Number(item[column.property]));
      sums[index] = formatCurrency(
        values.reduce((prev: number, curr: number) => prev + curr, 0)
      );
    } else {
      sums[index] = '';
    }
  });
  
  return sums;
};

const loadDailyPayments = async () => {
  if (!selectedDate.value) {
    ElMessage.warning('Veuillez sélectionner une date');
    return;
  }

  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('payment:getByDate', selectedDate.value);
    
    if (result.success && result.data) {
      dailyPayments.value = result.data;
      if (result.data.length === 0) {
        ElMessage.info('Aucun paiement pour cette date');
      }
    } else {
      dailyPayments.value = [];
      ElMessage.warning(result.message || 'Aucun paiement trouvé');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
    ElMessage.error('Erreur lors du chargement des paiements');
    dailyPayments.value = [];
  } finally {
    loading.value = false;
  }
};

const printDailyReport = async () => {
  try {
    if (dailyPayments.value.length === 0) {
      ElMessage.warning('Aucun paiement à imprimer');
      return;
    }

    const schoolInfo = await window.ipcRenderer.invoke('school:get');
    const schoolData = schoolInfo?.data || {};
    
    // Générer le HTML du bordereau
    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bordereau de paiement - ${selectedDate.value}</title>
        <style>
          @media print {
            @page { 
              margin: 10mm; 
              size: A4;
            }
            body { 
              margin: 0; 
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
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
            line-height: 1.4;
            color: #333;
            background: white;
          }
          
          .report-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 15px;
          }
          
          .header { 
            text-align: center;
            border-bottom: 2px solid #007bff; 
            padding-bottom: 10px; 
            margin-bottom: 15px;
          }
          
          .header h1 { 
            font-size: 18px; 
            margin: 0 0 5px 0; 
            color: #007bff;
          }
          
          .header h2 { 
            font-size: 14px; 
            margin: 5px 0; 
            color: #333;
          }
          
          .info-section {
            margin-bottom: 15px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          
          .payments-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0;
            font-size: 11px;
          }
          
          .payments-table th { 
            background: #007bff; 
            color: white;
            padding: 6px;
            text-align: left;
            font-weight: 600;
          }
          
          .payments-table td { 
            border-bottom: 1px solid #e9ecef; 
            padding: 5px;
          }
          
          .payments-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .summary { 
            margin-top: 15px;
            padding: 10px;
            background: #e7f3ff;
            border-radius: 4px;
            border: 1px solid #007bff;
          }
          
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          
          .total-row {
            border-top: 2px solid #007bff;
            padding-top: 8px;
            font-weight: bold;
            font-size: 14px;
          }
          
          .footer { 
            margin-top: 30px; 
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          
          .signature-box {
            width: 40%;
            text-align: center;
          }
          
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <h1>${schoolData.name || 'École'}</h1>
            <h2>BORDEREAU DE PAIEMENT JOURNALIER</h2>
            <p style="margin: 5px 0;">Date: ${new Date(selectedDate.value).toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span><strong>Établissement:</strong> ${schoolData.name || 'N/A'}</span>
              <span><strong>Téléphone:</strong> ${schoolData.phone || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span><strong>Adresse:</strong> ${schoolData.address || 'N/A'}</span>
              <span><strong>Email:</strong> ${schoolData.email || 'N/A'}</span>
            </div>
          </div>
          
          <table class="payments-table">
            <thead>
              <tr>
                <th style="width: 30px;">N°</th>
                <th style="width: 60px;">Heure</th>
                <th>Élève</th>
                <th style="width: 80px;">Matricule</th>
                <th style="width: 60px;">Classe</th>
                <th style="width: 80px;">Type</th>
                <th style="width: 80px; text-align: right;">Montant</th>
                <th style="width: 70px;">Mode</th>
              </tr>
            </thead>
            <tbody>
              ${dailyPayments.value.map((payment, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${formatTime(payment.created_at)}</td>
                  <td>${payment.student?.firstname || ''} ${payment.student?.lastname || ''}</td>
                  <td>${payment.student?.matricule || ''}</td>
                  <td>${payment.student?.grade?.name || ''}</td>
                  <td>${payment.paymentType === 'inscription' ? 'Inscription' : 'Scolarité'}</td>
                  <td style="text-align: right;">${formatCurrency(payment.amount)}</td>
                  <td>${formatPaymentMethod(payment.paymentMethod)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">Récapitulatif</h3>
            <div class="summary-row">
              <span>Nombre total de paiements:</span>
              <strong>${dailyPayments.value.length}</strong>
            </div>
            <div class="summary-row">
              <span>Total frais d'inscription:</span>
              <strong>${formatCurrency(totalInscription.value)}</strong>
            </div>
            <div class="summary-row">
              <span>Total frais de scolarité:</span>
              <strong>${formatCurrency(totalTuition.value)}</strong>
            </div>
            <div class="summary-row total-row">
              <span>TOTAL GÉNÉRAL:</span>
              <strong>${formatCurrency(totalAmount.value)}</strong>
            </div>
          </div>
          
          <div class="signature-section">
            <div class="signature-box">
              <p>Le Caissier</p>
              <div class="signature-line"></div>
            </div>
            <div class="signature-box">
              <p>Le Directeur</p>
              <div class="signature-line"></div>
            </div>
          </div>
          
          <div class="footer">
            <p style="text-align: center; font-size: 10px; color: #666;">
              Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Ouvrir une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };
      
      ElMessage.success('Bordereau prêt pour l\'impression');
    } else {
      ElMessage.error('Impossible d\'ouvrir la fenêtre d\'impression');
    }
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    ElMessage.error('Erreur lors de la génération du bordereau');
  }
};

const handleClose = () => {
  dialogVisible.value = false;
};

// Charger les paiements du jour à l'ouverture
watch(dialogVisible, (newVal) => {
  if (newVal) {
    selectedDate.value = new Date().toISOString().split('T')[0];
    loadDailyPayments();
  }
});
</script>

<style scoped>
.daily-payment-report {
  padding: 10px;
}

.date-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.daily-summary {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>