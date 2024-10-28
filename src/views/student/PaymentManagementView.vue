<template>
  <el-container>
    <el-aside width="200px">
      <el-card class="h-100">
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold; writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);">
            Gestion des Paiements
          </el-text>
        </el-row>
      </el-card>
    </el-aside>
    
    <el-main>
      <el-card class="h-100">
        <el-row :gutter="20">
          <el-col :span="24">
            <PaymentList 
              :payments="payments" 
              :loading="loading"
              :totalPayments="totalPayments"
              @refresh="loadPayments" 
              @page-change="handlePageChange"
            />
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <PaymentForm @payment-added="handlePaymentAdded" />
          </el-col>
        </el-row>
      </el-card>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PaymentList from '@/components/payment/PaymentList.vue';
import PaymentForm from '@/components/payment/PaymentForm.vue';
import { ElMessage } from 'element-plus';

interface Payment {
  id: number;
  studentId: number;
  amount: number;
  date: string;
  paymentType: string;
}

const payments = ref<Payment[]>([]);
const loading = ref(false);
const totalPayments = ref(0);

const loadPayments = async (page = 1) => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('payment:getAll', page);
    if (result.success) {
      payments.value = result.data.payments;
      totalPayments.value = result.data.total;
    } else {
      ElMessage.error("Erreur lors du chargement des paiements");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des paiements:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement des paiements");
  } finally {
    loading.value = false;
  }
};

const handlePaymentAdded = (newPayment: Payment) => {
  payments.value.unshift(newPayment);
  totalPayments.value++;
  ElMessage.success("Paiement ajouté avec succès");
};

const handlePageChange = (page: number) => {
  loadPayments(page);
};

onMounted(() => loadPayments());
</script>

<style scoped>
.el-container {
  height: calc(100vh - 60px); /* Ajustez selon la hauteur de votre en-tête */
}

.el-aside {
  background-color: #f0f2f5;
}

.el-main {
  padding: 20px;
}

.h-100 {
  height: 100%;
}
</style>
