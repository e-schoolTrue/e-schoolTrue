<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { type ComponentSize } from 'element-plus'
  import { ElMessage } from 'element-plus'
 
import { PaymentAnnualConfig } from '@/types/payment';

import { YearRepartition } from '@/types/year';
  
  const size = ref<ComponentSize>('default')
  const props = defineProps<{ dialog: boolean, config:PaymentAnnualConfig }>()
  const yearRepartition = ref<YearRepartition | null>(null)

  // Interface pour les échéances de paiement
  interface PaymentDue {
    trancheName: string;
    amount: number;
    dueDate: Date;
    period: string;
  }

  // Calculer les échéances de paiement
  const paymentDues = computed((): PaymentDue[] => {
    if (!props.config?.tranches || !yearRepartition.value?.periodConfigurations) {
      return [];
    }

    const dues: PaymentDue[] = [];
    const periods = yearRepartition.value.periodConfigurations;

    props.config.tranches.forEach((tranche, index) => {
      if (periods[index]) {
        const period = periods[index];
        dues.push({
          trancheName: tranche.tranchName || `Tranche ${index + 1}`,
          amount: tranche.amount || 0,
          dueDate: new Date(period.start),
          period: period.name
        });
      }
    });

    return dues.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  });

  // Charger la répartition de l'année
  const loadYearRepartition = async () => {
    try {
      const result = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
      if (result.success) {
        yearRepartition.value = result.data;
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la répartition:', error);
      ElMessage.error('Erreur lors du chargement des dates de répartition');
    }
  };

  onMounted(() => {
    loadYearRepartition();
  });

  // Fonctions utilitaires
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'Non défini';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getPaymentStatus = (dueDate: Date): string => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'danger'; // En retard
    if (diffDays <= 7) return 'warning'; // Bientôt dû
    return 'success'; // À venir
  };

  const getPaymentStatusText = (dueDate: Date): string => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'En retard';
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Demain';
    if (diffDays <= 7) return 'Cette semaine';
    return 'À venir';
  };
  
  const emit = defineEmits<{
    (e: 'closeDialog'): void
  }>()
</script>

<template>
    <el-dialog 
        v-model="props.dialog" 
        title="Détails de la configuration des tranches" 
        width="1000px"
        destroy-on-close
      >
        <!-- Informations générales -->
        <el-descriptions
          class="margin-top"
          title="Informations générales"
          :column="2"
          :size="size"
          border
        >
          <el-descriptions-item>
            <template #label>
              <el-space>
                <Icon icon="octicon:book-16" />
                <el-text>Classe</el-text>
              </el-space>
            </template>
            {{ props.config.grade?.name }}
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              <el-text>Nombre de tranches</el-text>
            </template>
            {{ props.config.trancheCount }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- Échéances de paiement -->
        <div class="payment-schedule-section">
          <el-divider>
            <el-text type="primary" size="large">
              <Icon icon="mdi:calendar-clock" style="margin-right: 8px;" />
              Échéances de paiement
            </el-text>
          </el-divider>
          
          <el-table 
            :data="paymentDues" 
            border 
            stripe
            empty-text="Aucune échéance configurée"
            class="payment-table"
          >
            <el-table-column prop="trancheName" label="Tranche" width="200">
              <template #default="scope">
                <el-space>
                  <Icon icon="mdi:currency-usd" color="#409EFF" />
                  <el-text strong>{{ scope.row.trancheName }}</el-text>
                </el-space>
              </template>
            </el-table-column>
            
            <el-table-column prop="period" label="Période" width="150">
              <template #default="scope">
                <el-tag type="info" size="small">
                  {{ scope.row.period }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column prop="dueDate" label="Date d'échéance" width="180">
              <template #default="scope">
                <el-space>
                  <Icon icon="mdi:calendar" color="#67C23A" />
                  <el-text>{{ formatDate(scope.row.dueDate) }}</el-text>
                </el-space>
              </template>
            </el-table-column>
            
            <el-table-column prop="amount" label="Montant" width="150">
              <template #default="scope">
                <el-text type="success" strong>
                  {{ formatCurrency(scope.row.amount) }}
                </el-text>
              </template>
            </el-table-column>
            
            <el-table-column label="Statut" width="120">
              <template #default="scope">
                <el-tag 
                  :type="getPaymentStatus(scope.row.dueDate)" 
                  size="small"
                >
                  {{ getPaymentStatusText(scope.row.dueDate) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

    
        <template #footer>
          <el-button type="primary" @click="emit('closeDialog')">Fermer</el-button>
        </template>
    </el-dialog>
</template>
  
  <style scoped>
  .el-descriptions {
    margin-top: 20px;
  }
  .cell-item {
    display: flex;
    align-items: center;
  }
  .margin-top {
    margin-top: 20px;
  }
  
  .payment-schedule-section {
    margin-top: 24px;
  }
  
  .tranche-details-section {
    margin-top: 24px;
  }
  
  .payment-table {
    margin-top: 16px;
  }
  
  :deep(.el-table--border th.el-table__cell) {
    background-color: #409EFF !important;
    color: #ffffff !important;
    font-weight: bold;
  }
  
  :deep(.el-table--border td.el-table__cell) {
    border-color: #EBEEF5;
  }
  
  :deep(.el-descriptions__label) {
    font-weight: 600;
    color: #606266;
  }
  
  :deep(.el-divider__text) {
    font-weight: 600;
    color: #409EFF;
  }
  
  .el-text {
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  }
  </style>