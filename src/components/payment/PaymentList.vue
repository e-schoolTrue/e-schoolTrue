<template>
  <el-card class="payment-list">
    <template #header>
      <div class="header-content">
        <h3>Liste des paiements</h3>
        <el-button type="primary" @click="$emit('refresh')">Rafraîchir</el-button>
      </div>
    </template>
    <el-table :data="displayedPayments" style="width: 100%" v-loading="loading">
      <el-table-column prop="studentId" label="ID Étudiant" width="120" />
      <el-table-column prop="amount" label="Montant" width="120">
        <template #default="scope">
          {{ scope.row.amount.toFixed(2) }} €
        </template>
      </el-table-column>
      <el-table-column prop="date" label="Date" width="180">
        <template #default="scope">
          {{ new Date(scope.row.date).toLocaleDateString() }}
        </template>
      </el-table-column>
      <el-table-column prop="paymentType" label="Type de paiement">
        <template #default="scope">
          <el-tag :type="getPaymentTypeTag(scope.row.paymentType)">
            {{ getPaymentTypeLabel(scope.row.paymentType) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination-container">
      <el-pagination
        v-if="totalPayments > pageSize"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalPayments"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { PropType, ref, computed } from 'vue';

interface Payment {
  id: number;
  studentId: number;
  amount: number;
  date: string;
  paymentType: string;
}

const props = defineProps({
  payments: {
    type: Array as PropType<Payment[]>,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  totalPayments: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['refresh', 'page-change']);

const currentPage = ref(1);
const pageSize = 10;

const handlePageChange = (page: number) => {
  currentPage.value = page;
  emit('page-change', page);
};

const displayedPayments = computed(() => {
  return props.payments.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize);
});

const getPaymentTypeTag = (type: string): string => {
  const tags: { [key: string]: string } = {
    tuition: 'primary',
    registration: 'success',
    canteen: 'warning',
    transport: 'info',
    other: 'danger'
  };
  return tags[type] || 'default';
};

const getPaymentTypeLabel = (type: string): string => {
  const labels: { [key: string]: string } = {
    tuition: 'Frais de scolarité',
    registration: "Frais d'inscription",
    canteen: 'Frais de cantine',
    transport: 'Frais de transport',
    other: 'Autre'
  };
  return labels[type] || type;
};
</script>

<style scoped>
.payment-list {
  max-width: 800px;
  margin: 0 auto;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
