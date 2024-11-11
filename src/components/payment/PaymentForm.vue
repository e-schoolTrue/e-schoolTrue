<template>
  <el-form :model="form" @submit.prevent="submitForm" label-position="top" class="payment-form">
    <el-card class="payment-details-card">
      <template #header>
        <h3 class="card-title">Détails du paiement</h3>
      </template>
      <div class="form-grid">
        <el-form-item label="Montant" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :max="configData?.annualAmount || 0" :step="getInstallmentAmount()" class="full-width"/>
          <div class="help-text">Max: {{ formatAmount(configData?.annualAmount || 0) }} FCFA</div>
        </el-form-item>

        <el-form-item label="Type de paiement" prop="paymentType">
          <el-radio-group v-model="form.paymentType" class="payment-type-group">
            <el-radio label="cash"><i class="el-icon-money"></i> Espèces</el-radio>
            <el-radio label="cheque"><i class="el-icon-document"></i> Chèque</el-radio>
            <el-radio label="transfer"><i class="el-icon-bank-card"></i> Virement</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Numéro de versement" prop="installmentNumber">
          <el-input-number v-model="form.installmentNumber" :min="1" :max="configData?.installments || 1" class="full-width"/>
        </el-form-item>

        <el-form-item label="Référence" prop="reference" :rules="[requiredReferenceRule]" v-if="form.paymentType !== 'cash'">
          <el-input v-model="form.reference" placeholder="Référence du paiement">
            <template #prefix><i :class="getReferenceIcon()" class="reference-icon"></i></template>
          </el-input>
        </el-form-item>

        <el-form-item label="Notes" prop="notes" class="form-item notes-item">
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="Informations complémentaires..."/>
        </el-form-item>
      </div>
      <div class="form-actions">
        <el-button @click="emit('cancel')">Annuler</el-button>
        <el-button type="primary" native-type="submit" :loading="isSubmitting" :disabled="!isValid">Enregistrer le paiement</el-button>
      </div>
    </el-card>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

// Interface et propriétés
interface Props {
  studentData: {
    id: number;
    firstname: string;
    lastname: string;
    matricule: string;
  };
  configData?: {
    annualAmount: number;
    installments: number;
  };
}

const props = defineProps<Props>();
const emit = defineEmits(['payment-added', 'cancel']);

const form = ref({
  amount: 0,
  paymentType: '',
  installmentNumber: 1,
  reference: '',
  notes: ''
});

const isSubmitting = ref(false);
const requiredReferenceRule = { required: true, message: 'Référence requise', trigger: 'blur' };

const getInstallmentAmount = () => {
  if (props.configData?.annualAmount && props.configData?.installments) {
    return Math.round(props.configData.annualAmount / props.configData.installments);
  }
  return 0;
};

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

const getReferenceIcon = () => {
  switch(form.value.paymentType) {
    case 'cheque': return 'el-icon-document';
    case 'transfer': return 'el-icon-bank-card';
    default: return 'el-icon-document';
  }
};

const isValid = computed(() => {
  return form.value.amount > 0 && 
         form.value.paymentType && 
         form.value.installmentNumber >= 1 && 
         form.value.installmentNumber <= (props.configData?.installments || 1) &&
         (form.value.paymentType === 'cash' || form.value.reference.trim() !== '');
});

const submitForm = async () => {
  if (!isValid.value) {
    ElMessage.warning('Veuillez remplir tous les champs obligatoires');
    return;
  }

  isSubmitting.value = true;
  try {
    const paymentData = {
      ...form.value,
      studentId: props.studentData.id,
      paymentDate: new Date().toISOString(),
      schoolYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      amount: Number(form.value.amount),
      installmentNumber: Number(form.value.installmentNumber),
      paymentType: form.value.paymentType.toUpperCase(),
      reference: form.value.reference || null,
      notes: form.value.notes || null
    };

    const result = await window.ipcRenderer.invoke('payment:add', paymentData);

    if (result.success) {
      emit('payment-added', result.data);
      ElMessage({
        message: 'Paiement enregistré avec succès',
        type: 'success',
        duration: 3000,
        showClose: true
      });
      form.value = {
        amount: 0,
        paymentType: '',
        installmentNumber: 1,
        reference: '',
        notes: ''
      };
    } else {
      throw new Error(result.message || "Erreur lors de l'enregistrement du paiement");
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du paiement:", error);
    ElMessage({
      message: "Une erreur s'est produite lors de l'enregistrement",
      type: 'error',
      duration: 5000,
      showClose: true
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>


<style scoped>
.payment-form {
  max-width: 800px;
  margin: 0 auto;
}

.student-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.status-tag {
  text-transform: uppercase;
  font-size: 0.75rem;
}

.student-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.student-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-name h4 {
  margin: 0;
  font-weight: 500;
}

.matricule {
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: #606266;
}

.payment-overview {
  border-left: 1px solid #ebeef5;
  padding-left: 24px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.overview-item {
  text-align: center;
}

.overview-label {
  font-size: 0.875rem;
  color: #909399;
  margin-bottom: 4px;
}

.overview-value {
  font-weight: 600;
  color: #2c3e50;
}

.primary-text {
  color: #626aef;
}

.primary-bg {
  background-color: #626aef;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.form-item {
  margin-bottom: 0;
}

.notes-item {
  grid-column: span 2;
}

.payment-type-group {
  display: flex;
  gap: 24px;
}

.payment-type-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.currency-prefix {
  color: #909399;
}

.reference-icon {
  color: #909399;
}

.help-text {
  font-size: 0.75rem;
  color: #909399;
  margin-top: 4px;
}

.installment-steps {
  margin-bottom: 16px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.submit-button {
  padding-left: 24px;
  padding-right: 24px;
}

.cancel-button {
  padding-left: 24px;
  padding-right: 24px;
}

/* Styles pour les composants Element Plus */
:deep(.el-card__header) {
  padding: 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-input-number .el-input__wrapper) {
  width: 100%;
}

:deep(.el-radio) {
  margin-bottom: 0;
  height: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .student-info-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .payment-overview {
    border-left: none;
    border-top: 1px solid #ebeef5;
    padding-left: 0;
    padding-top: 24px;
  }

  .notes-item {
    grid-column: span 1;
  }

  .payment-type-group {
    flex-direction: column;
    gap: 12px;
  }
}
</style>