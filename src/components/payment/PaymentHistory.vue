<template>
  <el-dialog
    v-model="dialogVisible"
    :title="'Historique des paiements - ' + student?.firstname + ' ' + student?.lastname"
    width="700px"
  >
    <div class="payment-history">
      <div class="summary-cards">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-card shadow="hover">
              <div class="summary-item">
                <div class="label">Total payé</div>
                <div class="value success">
                  {{ formatAmount(totalPaid) }} FCFA
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="8">
            <el-card shadow="hover">
              <div class="summary-item">
                <div class="label">Montant annuel</div>
                <div class="value">
                  {{ formatAmount(annualAmount) }} FCFA
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :span="8">
            <el-card shadow="hover">
              <div class="summary-item">
                <div class="label">Reste à payer</div>
                <div class="value warning">
                  {{ formatAmount(remainingAmount) }} FCFA
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <div class="table-actions" style="margin-bottom: 15px;">
        <el-button type="success" @click="exportToExcel">
          <el-icon><Download /></el-icon>
          Exporter Excel
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="payments"
        border
        stripe
        style="width: 100%"
      >
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
            {{ formatAmount(row.amount) }} FCFA
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
          label="Actions"
          width="100"
          fixed="right"
          align="center"
        >
          <template #default="{ row }">
            <el-button
              type="primary"
              circle
              size="small"
              :icon="Printer"
              @click="printReceipt(row)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Printer, Download } from '@element-plus/icons-vue';
import printJS from 'print-js';
import * as XLSX from 'xlsx';

interface Props {
  visible: boolean;
  student: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const loading = ref(false);
const payments = ref([]);
const totalPaid = ref(0);
const annualAmount = ref(0);
const remainingAmount = ref(0);

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const getPaymentTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    tuition: 'primary',
    registration: 'success',
    uniform: 'warning',
    transport: 'info',
    cafeteria: 'danger'
  };
  return colors[type] || 'default';
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

const loadPayments = async () => {
  if (!props.student?.id) return;
  
  loading.value = true;
  try {
    const paymentsResult = await window.ipcRenderer.invoke('payment:getByStudent', props.student.id);
    
    const configResult = await window.ipcRenderer.invoke('payment:getConfig', props.student.grade?.id);

    if (paymentsResult?.success) {
      payments.value = paymentsResult.data;
      
      totalPaid.value = payments.value.reduce((sum: number, payment: any) => {
        return sum + Number(payment.amount || 0);
      }, 0);
    }

    if (configResult?.success && configResult.data) {
      annualAmount.value = Number(configResult.data.annualAmount || 0);
      
      remainingAmount.value = Math.max(0, annualAmount.value - totalPaid.value);
    }

  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
    ElMessage.error('Erreur lors du chargement des paiements');
  } finally {
    loading.value = false;
  }
};

const exportToExcel = () => {
  try {
    // Préparer les données pour l'export
    const exportData = payments.value.map((payment: {
      createdAt: string,
      paymentType: string,
      amount: number,
      paymentMethod: string,
      reference: string
    }) => ({
      'Date': formatDate(payment.createdAt),
      'Type': formatPaymentType(payment.paymentType), 
      'Montant': payment.amount,
      'Mode de paiement': formatPaymentMethod(payment.paymentMethod),
      'Référence': payment.reference || ''
    }));

    // Créer un workbook et une worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajouter la worksheet au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');

    // Générer le nom du fichier
    const fileName = `paiements_${props.student.firstname}_${props.student.lastname}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Sauvegarder le fichier
    XLSX.writeFile(wb, fileName);

    ElMessage.success('Export Excel réussi');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    ElMessage.error('Erreur lors de l\'export Excel');
  }
};

const printReceipt = async (payment: any) => {
  try {
    const schoolInfo = await window.ipcRenderer.invoke('school:get');
    const studentName = `${props.student.firstname} ${props.student.lastname}`;
    
    const content = `
      <div class="receipt-container" style="padding: 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${schoolInfo?.data?.logo ? `<img src="data:${schoolInfo.data.logo.type};base64,${schoolInfo.data.logo.content}" style="max-height: 100px; margin-bottom: 10px;">` : ''}
          <h2>${schoolInfo?.data?.name || 'École'}</h2>
          <h3>Reçu de Paiement N°${payment.id}</h3>
          <p style="margin: 5px 0;">Date: ${formatDate(payment.createdAt)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px;"><strong>Élève:</strong></td>
              <td style="padding: 5px;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Matricule:</strong></td>
              <td style="padding: 5px;">${props.student.matricule}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Classe:</strong></td>
              <td style="padding: 5px;">${props.student.grade?.name || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px;"><strong>Type de paiement:</strong></td>
              <td style="padding: 5px;">${formatPaymentType(payment.paymentType)}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Montant:</strong></td>
              <td style="padding: 5px;">${formatAmount(payment.amount)} FCFA</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Mode de paiement:</strong></td>
              <td style="padding: 5px;">${formatPaymentMethod(payment.paymentMethod)}</td>
            </tr>
            ${payment.reference ? `
            <tr>
              <td style="padding: 5px;"><strong>Référence:</strong></td>
              <td style="padding: 5px;">${payment.reference}</td>
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

watch(() => props.visible, (newValue) => {
  if (newValue) {
    loadPayments();
  }
});

watch(() => props.student, () => {
  if (dialogVisible.value) {
    loadPayments();
  }
}, { deep: true });
</script>

<style scoped>
.payment-history {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-cards {
  margin-bottom: 20px;
}

.summary-item {
  text-align: center;
}

.summary-item .label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 8px;
}

.summary-item .value {
  font-size: 18px;
  font-weight: 600;
}

.summary-item .value.success {
  color: var(--el-color-success);
}

.summary-item .value.warning {
  color: var(--el-color-warning);
}
</style>