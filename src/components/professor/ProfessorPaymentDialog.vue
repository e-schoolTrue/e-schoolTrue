<template>
  <el-dialog
    v-model="dialogVisible"
    :title="props.payment ? 'Modifier le paiement' : 'Nouveau paiement'"
    width="800px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="140px"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="Professeur" prop="professorId" v-if="!props.payment">
            <el-select 
              v-model="form.professorId" 
              class="w-full"
              filterable
              remote
              :remote-method="searchProfessors"
              :loading="loading"
            >
              <el-option
                v-for="prof in professors"
                :key="prof.id"
                :label="`${prof.firstname} ${prof.lastname}`"
                :value="prof.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="Montant brut" prop="grossAmount" required>
            <el-input-number
              v-model="form.grossAmount"
              :min="0"
              :step="1000"
              class="w-full"
              @change="calculateNetAmount"
            >
              <currency-display/>
            </el-input-number>
          </el-form-item>

          <el-form-item label="Type" prop="type">
            <el-select v-model="form.type" class="w-full">
              <el-option label="Salaire" value="salary" />
              <el-option label="Prime" value="bonus" />
              <el-option label="Heures sup." value="overtime" />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :span="12">
          <el-form-item label="Mode paiement" prop="paymentMethod">
            <el-select v-model="form.paymentMethod" class="w-full">
              <el-option label="Espèces" value="cash" />
              <el-option label="Chèque" value="check" />
              <el-option label="Virement" value="transfer" />
              <el-option label="Mobile Money" value="mobile_money" />
            </el-select>
          </el-form-item>

          <el-form-item label="Mois" prop="month">
            <el-date-picker
              v-model="form.month"
              type="month"
              format="MMMM YYYY"
              value-format="YYYY-MM"
              placeholder="Sélectionner le mois"
              class="w-full"
            />
          </el-form-item>

          <el-form-item label="Référence" prop="reference">
            <el-input
              v-model="form.reference"
              placeholder="Numéro de chèque, référence de virement..."
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider>Déductions</el-divider>
      <div class="deductions-container">
        <div v-for="(deduction, index) in form.deductions" :key="index" class="deduction-item">
          <el-input
            v-model="deduction.name"
            placeholder="Libellé (ex: CNPS, Mutuelle...)"
            class="deduction-name"
          />
          <el-input-number
            v-model="deduction.amount"
            :min="0"
            :step="100"
            :max="form.grossAmount"
            @change="calculateNetAmount"
          >
            <currency-display/>
          </el-input-number>
          <el-tooltip content="Supprimer">
            <el-button type="danger" circle @click="removeDeduction(index)">
              <Icon icon="mdi:delete" />
            </el-button>
          </el-tooltip>
        </div>

        <el-button type="primary" plain @click="addDeduction" class="add-deduction">
          <Icon icon="mdi:plus" /> Ajouter une déduction
        </el-button>
      </div>

      <el-form-item label="Total déductions" class="total-deductions">
        <currency-display :amount="totalDeductions" />
      </el-form-item>

      <el-form-item label="Montant net" prop="netAmount" required>
        <el-input-number
          v-model="form.netAmount"
          disabled
          class="w-full"
        >
        <currency-display/>
        </el-input-number>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">Annuler</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">
        {{ props.payment ? 'Modifier' : 'Ajouter' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
  subject?: string;
  qualification?: {
    name: string;
  };
}

interface Payment {
  id: number;
  professor: Professor;
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

interface PaymentFormData {
  professorId: number | undefined;
  amount: number;
  type: string;
  paymentMethod: string;
  month: string;
  reference: string;
  comment: string;
  grossAmount: number;
  netAmount: number;
  deductions: Array<{ name: string; amount: number }>;
}

interface Props {
  visible: boolean;
  professor: Professor | undefined;
  payment: Payment | undefined;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  professor: undefined,
  payment: undefined
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'payment-added'): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const loading = ref(false);
const professors = ref<Professor[]>([]);
const formRef = ref<FormInstance>();

const form = ref<PaymentFormData>({
  professorId: props.professor?.id,
  amount: 0,
  type: 'salary',
  paymentMethod: 'cash',
  month: new Date().toISOString().slice(0, 7),
  reference: '',
  comment: '',
  grossAmount: 0,
  netAmount: 0,
  deductions: [] as Array<{ name: string; amount: number }>,
});

const formRules = {
  professorId: [
    { required: true, message: 'Veuillez sélectionner un professeur', trigger: 'change' }
  ],
  amount: [
    { required: true, message: 'Veuillez saisir un montant', trigger: 'blur' },
    { type: 'number', min: 1, message: 'Le montant doit être supérieur à 0', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Veuillez sélectionner un type', trigger: 'change' }
  ],
  paymentMethod: [
    { required: true, message: 'Veuillez sélectionner un mode de paiement', trigger: 'change' }
  ],
  month: [
    { required: true, message: 'Veuillez sélectionner un mois', trigger: 'change' }
  ]
} satisfies FormRules;

const searchProfessors = async (query: string) => {
  if (query.length < 2) return; // Attendre au moins 2 caractères
  
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:search', query);
    if (result?.success) {
      professors.value = result.data;
      console.log('Professeurs trouvés:', professors.value);
    } else {
      console.error('Erreur lors de la recherche:', result?.error);
      professors.value = [];
    }
  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    professors.value = [];
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    loading.value = true;

    const paymentData = {
      professorId: form.value.professorId,
      type: form.value.type,
      paymentMethod: form.value.paymentMethod,
      month: form.value.month,
      reference: form.value.reference,
      comment: form.value.comment,
      amount: Number(form.value.grossAmount),
      grossAmount: Number(form.value.grossAmount),
      netAmount: Number(form.value.netAmount),
      deductions: form.value.deductions.map(d => ({
        name: d.name,
        amount: Number(d.amount)
      })),
      isPaid: false
    };

    const result = await window.ipcRenderer.invoke(
      props.payment ? 'professor:payment:update' : 'professor:payment:create',
      paymentData
    );

    if (result?.success) {
      ElMessage.success(props.payment ? 'Paiement modifié' : 'Paiement ajouté');
      emit('payment-added');
      handleClose();
    } else {
      throw new Error(result?.message || 'Erreur lors de l\'enregistrement');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement');
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  formRef.value?.resetFields();
  dialogVisible.value = false;
};

watch(() => props.payment, (newPayment) => {
  if (newPayment) {
    form.value = {
      professorId: newPayment.professor.id,
      amount: newPayment.amount,
      type: newPayment.type,
      paymentMethod: newPayment.paymentMethod,
      month: newPayment.month,
      reference: newPayment.reference || '',
      comment: newPayment.comment || '',
      grossAmount: 0,
      netAmount: 0,
      deductions: [] as Array<{ name: string; amount: number }>,
    };
  } else {
    // Réinitialiser le formulaire si aucun paiement n'est sélectionné
    form.value = {
      professorId: props.professor?.id,
      amount: 0,
      type: 'salary',
      paymentMethod: 'cash',
      month: new Date().toISOString().slice(0, 7),
      reference: '',
      comment: '',
      grossAmount: 0,
      netAmount: 0,
      deductions: [] as Array<{ name: string; amount: number }>,
    };
  }
}, { immediate: true });

const calculateNetAmount = () => {
  const totalDeductions = form.value.deductions.reduce((sum, d) => sum + d.amount, 0);
  form.value.netAmount = form.value.grossAmount - totalDeductions;
};

const addDeduction = () => {
  form.value.deductions.push({ name: '', amount: 0 });
};

const removeDeduction = (index: number) => {
  form.value.deductions.splice(index, 1);
  calculateNetAmount();
};


const totalDeductions = computed(() => {
  return form.value.deductions.reduce((sum, d) => sum + d.amount, 0);
});
</script>

<style scoped>
.w-full {
  width: 100%;
}

:deep(.el-input-number) {
  width: 100%;
}

.deductions-container {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.deduction-item {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.total-deductions {
  background-color: var(--el-color-info-light-9);
  padding: 10px;
  border-radius: 4px;
}

.amount {
  font-weight: bold;
  color: var(--el-color-info);
}

.add-deduction {
  width: 100%;
  margin-top: 10px;
}

.el-dialog {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.el-dialog__body {
  overflow-y: auto;
  flex: 1;
}
</style>