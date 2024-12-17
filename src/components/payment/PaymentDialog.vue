<template>
  <el-dialog
    v-model="dialogVisible"
    :title="'Nouveau paiement - ' + student?.firstname + ' ' + student?.lastname"
    width="500px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="140px"
    >
      <el-form-item label="Montant" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :max="config?.annualAmount"
          :step="1000"
          class="w-full"
        >
          <template #suffix>FCFA</template>
        </el-input-number>
        <small class="amount-info">
          Montant annuel: {{ formatAmount(config?.annualAmount || 0) }} FCFA
        </small>
      </el-form-item>

      <el-form-item label="Type" prop="type">
        <el-select v-model="form.type" class="w-full">
          <el-option label="Frais de scolarité" value="tuition" />
          <el-option label="Frais d'inscription" value="registration" />
          <el-option label="Uniforme" value="uniform" />
          <el-option label="Transport" value="transport" />
          <el-option label="Cantine" value="cafeteria" />
        </el-select>
      </el-form-item>

      <el-form-item label="Mode de paiement" prop="paymentMethod">
        <el-select v-model="form.paymentMethod" class="w-full">
          <el-option label="Espèces" value="cash" />
          <el-option label="Chèque" value="check" />
          <el-option label="Virement" value="transfer" />
          <el-option label="Mobile Money" value="mobile_money" />
        </el-select>
      </el-form-item>

      <el-form-item label="Référence" prop="reference">
        <el-input
          v-model="form.reference"
          placeholder="Numéro de chèque, référence de transaction..."
        />
      </el-form-item>

      <el-form-item label="Commentaire" prop="comment">
        <el-input
          v-model="form.comment"
          type="textarea"
          :rows="3"
          placeholder="Commentaire optionnel..."
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">Annuler</el-button>
      <el-button
        type="primary"
        :loading="loading"
        @click="handleSubmit"
      >
        Enregistrer
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';

interface Props {
  visible: boolean;
  student: any;
  config: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible', 'payment-added']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = ref({
  amount: 0,
  type: 'tuition',
  paymentMethod: 'cash',
  reference: '',
  comment: ''
});

const rules: FormRules = {
  amount: [
    { required: true, message: 'Veuillez saisir un montant', trigger: 'blur' },
    { type: 'number', min: 1, message: 'Le montant doit être supérieur à 0', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Veuillez sélectionner un type', trigger: 'change' }
  ],
  paymentMethod: [
    { required: true, message: 'Veuillez sélectionner un mode de paiement', trigger: 'change' }
  ]
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

interface PaymentData {
  studentId: number;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  reference?: string;
  comment?: string;
  installmentNumber: number;
  schoolYear: string;
}

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    loading.value = true;

    const paymentData: PaymentData = {
      studentId: props.student.id,
      amount: form.value.amount,
      paymentType: form.value.type,
      paymentMethod: form.value.paymentMethod,
      reference: form.value.reference,
      comment: form.value.comment,
      installmentNumber: 1,
      schoolYear: new Date().getFullYear().toString()
    };

    console.log('Données de paiement à envoyer:', paymentData);

    const result = await window.ipcRenderer.invoke('payment:create', paymentData);

    if (result?.success) {
      ElMessage.success('Paiement enregistré avec succès');
      emit('payment-added');
      handleClose();
    } else {
      throw new Error(result?.message || 'Erreur lors de l\'enregistrement');
    }
  } catch (error: any) {
    console.error('Erreur lors de la soumission:', error);
    ElMessage.error(error.message || 'Erreur lors de l\'enregistrement du paiement');
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  formRef.value?.resetFields();
  dialogVisible.value = false;
};
</script>

<style scoped>
.w-full {
  width: 100%;
}

.amount-info {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

:deep(.el-input-number) {
  width: 100%;
}
</style> 