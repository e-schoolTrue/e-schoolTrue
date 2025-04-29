<template>
  <div class="payment-history-mini">
    <div class="summary-section">
      <el-row :gutter="10">
        <el-col :span="8">
          <div class="summary-item">
            <div class="label">Total payé</div>
            <div class="value success">
              <currency-display :amount="totalPaid" />
            </div>
          </div>
        </el-col>
        
        <el-col :span="8">
          <div class="summary-item">
            <div class="label">Montant annuel</div>
            <div class="value">
              <currency-display :amount="adjustedAnnualAmount" />
            </div>
          </div>
        </el-col>
        
        <el-col :span="8">
          <div class="summary-item">
            <div class="label">Reste à payer</div>
            <div class="value warning">
              <currency-display :amount="remainingAmount" />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-table
      v-loading="loading"
      :data="paymentData"
      border
      stripe
      size="small"
      style="width: 100%; margin-top: 10px;"
    >
      <el-table-column
        label="Date"
        prop="createdAt"
        width="100"
      >
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column
        label="Type"
        prop="type"
        width="120"
      >
        <template #default="{ row }">
          <el-tag size="small" :type="getPaymentTypeColor(row.paymentType || row.type)">
            {{ formatPaymentType(row.paymentType || row.type) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column
        label="Montant"
        width="130"
      >
        <template #default="{ row }">
          <div class="payment-amount">
            <currency-display :amount="row.amount" />
            <template v-if="row.scholarshipPercentage > 0">
              <el-tag size="small" type="success">{{ row.scholarshipPercentage }}%</el-tag>
            </template>
          </div>
        </template>
      </el-table-column>

      <el-table-column
        label="Mode"
        prop="paymentMethod"
        width="100"
      >
        <template #default="{ row }">
          {{ formatPaymentMethod(row.paymentMethod) }}
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue';
import { ElMessage } from 'element-plus';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';

interface Props {
  student: any;
}

const props = defineProps<Props>();
const loading = ref(false);
const paymentData = ref([]);
const totalPaid = ref(0);
const annualAmount = ref(0);
const remainingAmount = ref(0);
const adjustedAnnualAmount = ref(0);

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
  try {
    if (!props.student?.id) return;
    
    loading.value = true;
    const result = await window.ipcRenderer.invoke('payment:getByStudent', props.student.id);

    if (!result.success || !result.data) {
      console.warn('Aucun paiement trouvé pour cet étudiant');
      paymentData.value = [];
      return;
    }

    const { 
      payments = [], 
      baseAmount = 0, 
      scholarshipAmount = 0,
      adjustedAmount = 0,
      scholarshipPercentage = 0 
    } = result.data;
    
    // Mettre à jour les montants avec la bourse
    annualAmount.value = Number(baseAmount);
    adjustedAnnualAmount.value = Number(adjustedAmount) || Number(baseAmount);
    
    // Calculer le total payé
    if (Array.isArray(payments)) {
      paymentData.value = payments;
      totalPaid.value = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    } else {
      paymentData.value = [];
      totalPaid.value = 0;
    }
    
    // Calculer le reste à payer en utilisant le montant ajusté
    remainingAmount.value = Math.max(0, adjustedAnnualAmount.value - totalPaid.value);
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
    ElMessage.error('Erreur lors du chargement des paiements');
  } finally {
    loading.value = false;
  }
};

watchEffect(() => {
  if (props.student?.id) {
    loadPayments();
  }
});
</script>

<style scoped>
.payment-history-mini {
  padding: 15px;
  margin-top: 10px;
}

.summary-section {
  margin-bottom: 15px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px;
}

.summary-item {
  text-align: center;
  padding: 8px;
}

.summary-item .label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 5px;
}

.summary-item .value {
  font-size: 14px;
  font-weight: 600;
}

.summary-item .value.success {
  color: var(--el-color-success);
}

.summary-item .value.warning {
  color: var(--el-color-warning);
}

.payment-amount {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style> 