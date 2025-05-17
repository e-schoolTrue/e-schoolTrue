<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="900px"
    class="payment-dialog"
  >
    <div class="dialog-content">
      <div class="left-column">
    <div class="student-header">
      <el-avatar :size="50" :src="student?.photo?.url">
        {{ getInitials() }}
      </el-avatar>
      <div class="student-info">
        <h3>{{ student?.firstname }} {{ student?.lastname }}</h3>
        <span class="matricule">{{ student?.matricule }}</span>
        <span class="grade">{{ student?.grade?.name }}</span>
      </div>
    </div>

    <div class="payment-summary">
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="summary-card">
            <div class="label">Montant annuel</div>
            <div class="value">
              <currency-display :amount="config?.annualAmount || 0" />
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="label">Déjà payé</div>
            <div class="value success">
              <currency-display :amount="totalPaid || 0" />
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-card">
            <div class="label">Reste à payer</div>
            <div class="value warning">
              <currency-display :amount="remainingAmount || 0" />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

        <div v-if="form.amount > 0" class="payment-preview">
          <h4>Aperçu du paiement</h4>
          <div class="preview-content">
            <div class="preview-item">
              <span>Montant saisi:</span>
              <strong><currency-display :amount="form.amount" /></strong>
            </div>
            <div v-if="form.hasScholarship && form.scholarshipPercentage" class="preview-item scholarship">
              <span>Bourse appliquée:</span>
              <strong>-{{ form.scholarshipPercentage }}%</strong>
            </div>
            <div class="preview-item total">
              <span>Total à payer (ce versement):</span>
              <strong><currency-display :amount="getAdjustedAmountForCurrentPayment()" /></strong>
            </div>
          </div>
        </div>
      </div>

      <div class="right-column">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="140px"
      class="payment-form"
    >
      <el-form-item label="Montant à payer" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :max="getMaxAmountToPay"
          :step="1000"
          class="w-full"
          controls-position="right"
        >
          <template #suffix>{{ currency }}</template>
        </el-input-number>
        <small v-if="form.hasScholarship && form.scholarshipPercentage && config?.annualAmount" class="amount-info">
          Montant annuel total (après bourse): <currency-display :amount="getAdjustedAnnualAmount()" />
        </small>
      </el-form-item>

      <el-form-item label="Type" prop="type">
        <el-select v-model="form.type" class="w-full" placeholder="Sélectionner un type">
          <el-option label="Frais de scolarité" value="tuition" />
          <el-option label="Frais d'inscription" value="registration" />
          <el-option label="Uniforme" value="uniform" />
          <el-option label="Transport" value="transport" />
          <el-option label="Cantine" value="cafeteria" />
          <el-option label="Autre" value="other" />
        </el-select>
      </el-form-item>

      <el-form-item label="Mode de paiement" prop="paymentMethod">
        <el-select v-model="form.paymentMethod" class="w-full" placeholder="Sélectionner un mode">
          <el-option label="Espèces" value="cash" />
          <el-option label="Chèque" value="check" />
          <el-option label="Virement" value="transfer" />
          <el-option label="Mobile Money" value="mobile_money" />
        </el-select>
      </el-form-item>

      <el-form-item label="Référence" prop="reference">
        <el-input
          v-model="form.reference"
          placeholder="Numéro de chèque, transaction ID..."
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

      <el-form-item label="Bourse" v-if="config && config.allowScholarship">
        <div class="scholarship-section">
          <el-switch
            v-model="form.hasScholarship"
            active-text="Appliquer une bourse sur le montant annuel"
            @change="handleScholarshipSwitchChange"
          />
          
          <template v-if="form.hasScholarship">
            <el-select
              v-model="form.scholarshipPercentage"
              placeholder="Sélectionner le pourcentage"
              class="scholarship-select"
              clearable
              style="margin-top: 10px; width: 100%;"
              @change="recalculateMaxAmount"
            >
              <el-option
                v-for="percentage in config.scholarshipPercentages"
                :key="percentage"
                :label="`${percentage}%`"
                :value="percentage"
              />
            </el-select>

            <div class="scholarship-info" v-if="form.scholarshipPercentage && config?.annualAmount">
              <p>Montant annuel initial: <currency-display :amount="config.annualAmount" /></p>
              <p class="reduction">
                Réduction de bourse: -<currency-display :amount="getScholarshipReductionAmountOnAnnual()" />
              </p>
              <p class="final-amount">
                Montant annuel après bourse: <currency-display :amount="getAdjustedAnnualAmount()" />
              </p>
            </div>
          </template>
        </div>
      </el-form-item>
    </el-form>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">Annuler</el-button>
      <el-button
        type="primary"
        :loading="loading"
        @click="handleSubmit"
      >
        Enregistrer le paiement
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { Student } from '@/types/card';
import { PaymentConfig, IPaymentData, StudentPaymentData } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';

interface Props {
  visible: boolean;
  student: Student | null;
  config: PaymentConfig | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:visible', 'payment-added']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref<FormInstance>();
const loading = ref(false);

interface PaymentForm {
  amount: number;
  type: string;
  paymentMethod: string;
  reference: string;
  comment: string;
  hasScholarship: boolean;
  scholarshipPercentage: number | null;
}

const initialFormState = (): PaymentForm => ({
  amount: 0,
  type: 'tuition',
  paymentMethod: 'cash',
  reference: '',
  comment: '',
  hasScholarship: false,
  scholarshipPercentage: null,
});

const form = ref<PaymentForm>(initialFormState());

const rules: FormRules = {
  amount: [
    { required: true, message: 'Veuillez saisir un montant', trigger: 'blur' },
    { type: 'number', min: 0.01, message: 'Le montant doit être supérieur à 0', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Veuillez sélectionner un type', trigger: 'change' }
  ],
  paymentMethod: [
    { required: true, message: 'Veuillez sélectionner un mode de paiement', trigger: 'change' }
  ],
  scholarshipPercentage: [
    { validator: (_rule, value, callback) => {
        if (form.value.hasScholarship && (value === null || value === undefined || value <=0)) {
          callback(new Error('Veuillez sélectionner un pourcentage de bourse valide'));
        } else {
          callback();
        }
      }, trigger: 'change'
    }
  ]
};


interface PaymentDataToSend {
  studentId: number;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  reference?: string;
  comment?: string;
  installmentNumber: number;
  schoolYear: string;
  scholarshipAppliedOnAnnual: boolean;
  annualScholarshipPercentage?: number;
  annualScholarshipAmount?: number;
  annualAmountAfterScholarship?: number;
  baseAnnualAmount?: number;
}

const dialogTitle = computed(() => {
  return `Nouveau paiement - ${props.student?.firstname} ${props.student?.lastname}`;
});

const totalPaid = ref(0);

const remainingAmount = computed(() => {
  const adjustedAnnual = getAdjustedAnnualAmount();
  return Math.max(0, adjustedAnnual - totalPaid.value);
});

const getInitials = () => {
  if (!props.student?.firstname || !props.student?.lastname) return '';
  return `${props.student.firstname[0]}${props.student.lastname[0]}`.toUpperCase();
};

const getAdjustedAnnualAmount = () => {
  if (!props.config?.annualAmount) return 0;
  const baseAnnual = props.config.annualAmount;
  if (form.value.hasScholarship && form.value.scholarshipPercentage) {
    return baseAnnual * (1 - form.value.scholarshipPercentage / 100);
  }
  return baseAnnual;
};

const getScholarshipReductionAmountOnAnnual = () => {
  if (!form.value.hasScholarship || !form.value.scholarshipPercentage || !props.config?.annualAmount) {
    return 0;
  }
  return (props.config.annualAmount * form.value.scholarshipPercentage) / 100;
};

const getAdjustedAmountForCurrentPayment = () => {
  return form.value.amount;
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    const isValid = await formRef.value.validate();
    if (!isValid) return;

    loading.value = true;

    const paymentDataToSend: PaymentDataToSend = {
      studentId: props.student?.id ?? 0,
      amount: form.value.amount,
      paymentType: form.value.type,
      paymentMethod: form.value.paymentMethod,
      reference: form.value.reference,
      comment: form.value.comment,
      installmentNumber: 1,
      schoolYear: props.config?.classId.split('-')[1] || new Date().getFullYear().toString(),
      
      scholarshipAppliedOnAnnual: form.value.hasScholarship && !!form.value.scholarshipPercentage,
      annualScholarshipPercentage: form.value.hasScholarship ? form.value.scholarshipPercentage || 0 : 0,
      annualScholarshipAmount: form.value.hasScholarship ? getScholarshipReductionAmountOnAnnual() : 0,
      annualAmountAfterScholarship: form.value.hasScholarship ? getAdjustedAnnualAmount() : props.config?.annualAmount || 0,
      baseAnnualAmount: props.config?.annualAmount || 0,
    };

    console.log('Données finales du paiement envoyées:', JSON.stringify(paymentDataToSend, null, 2));

    const result = await window.ipcRenderer.invoke('payment:create', paymentDataToSend);

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

const resetForm = () => {
  form.value = initialFormState();
  if (props.config?.allowScholarship && studentScholarshipPercentageFromLoad.value) {
      form.value.hasScholarship = true;
      form.value.scholarshipPercentage = studentScholarshipPercentageFromLoad.value;
  }
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

const handleClose = () => {
  resetForm();
  dialogVisible.value = false;
};

const getMaxAmountToPay = computed(() => {
  return remainingAmount.value;
});

const handleScholarshipSwitchChange = (isActive: boolean) => {
  if (!isActive) {
    form.value.scholarshipPercentage = null;
  }
  else if (studentScholarshipPercentageFromLoad.value) {
     form.value.scholarshipPercentage = studentScholarshipPercentageFromLoad.value;
  }
  recalculateMaxAmount();
};

const recalculateMaxAmount = () => {
  // This function is called by the @change of the percentage select
  // It doesn't need to do much here as getMaxAmountToPay is a computed property
  // which already depends on form.scholarshipPercentage and totalPaid.
  // Force an update if necessary, but Vue should do it automatically.
};

watch(() => props.config, (newConfig) => {
  console.log('Config reçue dans le dialogue:', newConfig);
}, { immediate: true, deep: true });

const { currency } = useCurrency();

const studentScholarshipPercentageFromLoad = ref<number | null>(null);

const loadPaymentData = async () => {
  loading.value = true;
  totalPaid.value = 0;
  studentScholarshipPercentageFromLoad.value = null;
  resetForm();

  try {
    if (!props.student?.id) return;
    
    const result: { success: boolean, data: StudentPaymentData | null, message?: string } = 
      await window.ipcRenderer.invoke('payment:getByStudent', props.student.id);
    
    if (result.success && result.data) {
      const payments = Array.isArray(result.data.payments) ? result.data.payments : [];
      totalPaid.value = payments.reduce((sum: number, payment: IPaymentData) => {
        return sum + (Number(payment.amount) || 0);
      }, 0);
      
      if (props.config?.allowScholarship && result.data.scholarshipPercentage > 0) {
        studentScholarshipPercentageFromLoad.value = result.data.scholarshipPercentage;
        form.value.hasScholarship = true;
        form.value.scholarshipPercentage = result.data.scholarshipPercentage;
      }
    } else {
      console.warn("Impossible de charger les données de paiement:", result.message)
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
    ElMessage.error('Erreur lors du chargement des données de paiement.');
  } finally {
    loading.value = false;
  }
};

watch(() => props.visible, (newValue) => {
  if (newValue && props.student) {
    loadPaymentData();
  } else if (!newValue) {
    resetForm();
  }
}, { immediate: true });

watch(() => props.config?.annualAmount, () => {
    recalculateMaxAmount();
});

</script>

<style scoped>
.dialog-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  max-height: 70vh;
  overflow: hidden;
}

.left-column, .right-column {
  overflow-y: auto;
  padding: 5px;
}

.left-column {
  padding-right: 24px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.payment-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 10px;
  overflow: hidden;
}

.student-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.student-info h3 {
  font-size: 1.1em;
}

.payment-summary {
  margin-bottom: 20px;
}

.summary-card {
  padding: 10px;
}

.summary-card .label {
  font-size: 0.85em;
}

.summary-card .value {
  font-size: 1em;
}

.payment-form {
  margin-top: 0;
}

.payment-preview {
  margin-top: 20px;
  padding: 12px;
}

.payment-preview h4 {
  margin-bottom: 10px;
}

.scholarship-section {
  background-color: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 6px;
  margin-top: 10px;
}

.scholarship-info p {
  margin: 6px 0;
  font-size: 0.9em;
}

.scholarship-select {
  width: 100%;
  margin-top: 10px;
}
.w-full {
  width: 100%;
}
.amount-info {
  display: block;
  margin-top: 5px;
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
}
</style> 