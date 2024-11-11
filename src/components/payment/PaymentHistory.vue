<template>
  <div class="payment-history">
    <!-- Cards de résumé -->
    <div class="summary-section">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="summary-card total">
            <div class="card-content">
              <div class="icon-container">
                <el-icon><Money /></el-icon>
              </div>
              <div class="text-container">
                <h3>Montant Total</h3>
                <p>{{ formatAmount(paymentSummary.totalAmount) }} FCFA</p>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="summary-card paid">
            <div class="card-content">
              <div class="icon-container success">
                <el-icon><CircleCheckFilled /></el-icon>
              </div>
              <div class="text-container">
                <h3>Montant Payé</h3>
                <p class="success-text">{{ formatAmount(paymentSummary.totalPaid) }} FCFA</p>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="summary-card remaining">
            <div class="card-content">
              <div class="icon-container" :class="getRemainingIconClass()">
                <el-icon><WalletFilled /></el-icon>
              </div>
              <div class="text-container">
                <h3>Reste à Payer</h3>
                <p :class="getRemainingClass()">
                  {{ formatAmount(paymentSummary.remaining) }} FCFA
                </p>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="6">
          <el-card class="summary-card installments">
            <div class="card-content">
              <div class="icon-container info">
                <el-icon><Document /></el-icon>
              </div>
              <div class="text-container">
                <h3>Versements</h3>
                <p class="info-text">{{ paymentSummary.installments }} fois</p>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Tableau des paiements -->
    <div class="payment-table">
      <el-card>
        <template #header>
          <div class="table-header">
            <h2>Historique des Paiements</h2>
            <el-button type="primary" :icon="Plus">
              Nouveau Paiement
            </el-button>
          </div>
        </template>
        
        <el-table 
          :data="payments" 
          style="width: 100%"
          :border="true"
          :stripe="true"
          height="450"
        >
          <el-table-column 
            label="Date" 
            prop="paymentDate" 
            width="150"
            :formatter="formatDate"
          />
          <el-table-column 
            label="Montant" 
            prop="amount" 
            width="180"
            align="right"
          >
            <template #default="{ row }">
              <span class="amount-cell">
                {{ formatAmount(row.amount) }} FCFA
              </span>
            </template>
          </el-table-column>
          <el-table-column 
            label="Type" 
            prop="paymentType"
            width="150"
          >
            <template #default="{ row }">
              <el-tag
                :type="getPaymentTypeTag(row.paymentType)"
                effect="light"
                size="large"
                round
              >
                {{ formatPaymentType(row.paymentType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column 
            label="N° Versement" 
            prop="installmentNumber" 
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-badge :value="row.installmentNumber" type="primary" />
            </template>
          </el-table-column>
          <el-table-column 
            label="Référence" 
            prop="reference"
            show-overflow-tooltip
          />
          <el-table-column 
            label="Notes" 
            prop="notes"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <el-tooltip 
                :content="row.notes" 
                placement="top" 
                v-if="row.notes"
              >
                <span class="notes-cell">{{ row.notes }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="!payments.length" class="empty-state">
          <el-empty description="Aucun paiement enregistré" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { 
  Money, 
  CircleCheckFilled, 
  WalletFilled, 
  Document,
  Plus 
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  studentId: {
    type: Number,
    required: true
  }
});

const payments = ref([]);
const paymentSummary = ref({
  totalAmount: 0,
  totalPaid: 0,
  remaining: 0,
  installments: 0
});

const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

const formatDate = (row) => {
  return new Date(row.paymentDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatPaymentType = (type) => {
  const types = {
    'cash': 'Espèces',
    'cheque': 'Chèque',
    'transfer': 'Virement',
    'other': 'Autre'
  };
  return types[type] || type;
};

const getPaymentTypeTag = (type) => {
  const types = {
    'cash': 'success',
    'cheque': 'warning',
    'transfer': 'info',
    'other': ''
  };
  return types[type] || '';
};

const getRemainingClass = () => {
  if (paymentSummary.value.remaining <= 0) return 'success-text';
  if (paymentSummary.value.remaining < paymentSummary.value.totalAmount / 2) return 'warning-text';
  return 'danger-text';
};

const getRemainingIconClass = () => {
  if (paymentSummary.value.remaining <= 0) return 'success';
  if (paymentSummary.value.remaining < paymentSummary.value.totalAmount / 2) return 'warning';
  return 'danger';
};

const loadPayments = async () => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getByStudent', props.studentId);
    if (result.success) {
      payments.value = result.data;
    } else {
      ElMessage.error('Erreur lors du chargement des paiements');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Une erreur est survenue');
  }
};

const loadSummary = async () => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getRemainingAmount', props.studentId);
    console.log("historique:", result)
    if (result.success) {
      paymentSummary.value = result.data;
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
};

onMounted(async () => {
  await Promise.all([loadPayments(), loadSummary()]);
});
</script>

<style>
.payment-history {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.summary-section {
  margin-bottom: 32px;
}

.summary-card {
  height: 140px;
  transition: transform 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-5px);
}

.card-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.icon-container {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  background-color: var(--el-color-primary-light-9);
}

.icon-container .el-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.icon-container.success {
  background-color: var(--el-color-success-light-9);
}

.icon-container.success .el-icon {
  color: var(--el-color-success);
}

.icon-container.warning {
  background-color: var(--el-color-warning-light-9);
}

.icon-container.warning .el-icon {
  color: var(--el-color-warning);
}

.icon-container.danger {
  background-color: var(--el-color-danger-light-9);
}

.icon-container.danger .el-icon {
  color: var(--el-color-danger);
}

.icon-container.info {
  background-color: var(--el-color-info-light-9);
}

.icon-container.info .el-icon {
  color: var(--el-color-info);
}

.text-container h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.text-container p {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.success-text {
  color: var(--el-color-success) !important;
}

.warning-text {
  color: var(--el-color-warning) !important;
}

.danger-text {
  color: var(--el-color-danger) !important;
}

.info-text {
  color: var(--el-color-info) !important;
}

.payment-table {
  margin-top: 24px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.table-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.amount-cell {
  font-family: monospace;
  font-weight: 600;
}

.notes-cell {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 40px 0;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .el-col {
    width: 50%;
    margin-bottom: 20px;
  }
}

@media (max-width: 768px) {
  .el-col {
    width: 100%;
  }
  
  .payment-history {
    padding: 16px;
  }
  
  .card-content {
    padding: 16px;
  }
  
  .text-container p {
    font-size: 20px;
  }
}
</style>