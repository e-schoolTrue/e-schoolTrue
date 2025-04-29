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
      <el-avatar :size="50" :src="student?.photo?.path">
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
              <span>Montant:</span>
              <strong><currency-display :amount="form.amount" /></strong>
            </div>
            <div v-if="form.hasScholarship" class="preview-item scholarship">
              <span>Bourse appliquée:</span>
              <strong>-{{ form.scholarshipPercentage }}%</strong>
            </div>
            <div class="preview-item total">
              <span>Total à payer:</span>
              <strong><currency-display :amount="getAdjustedAmount()" /></strong>
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
      <el-form-item label="Montant" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :max="getMaxAmount"
          :step="1000"
          class="w-full"
        >
          <template #suffix>{{ currency }}</template>
        </el-input-number>
        <small v-if="form.scholarshipPercentage" class="amount-info">
          Montant initial: <currency-display :amount="config?.annualAmount || 0" />
          <br>
          Réduction: {{ form.scholarshipPercentage }}%
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

      <el-form-item label="Bourse" v-if="config && config.allowScholarship">
        <div class="scholarship-section">
          <el-switch
            v-model="form.hasScholarship"
            active-text="Activer la bourse"
          />
          
          <template v-if="form.hasScholarship">
            <el-select
              v-model="form.scholarshipPercentage"
              placeholder="Sélectionner le pourcentage"
              class="scholarship-select"
            >
              <el-option
                v-for="percentage in config.scholarshipPercentages"
                :key="percentage"
                :label="`${percentage}%`"
                :value="percentage"
              />
            </el-select>

            <div class="scholarship-info" v-if="form.scholarshipPercentage">
              <p>Montant initial: <currency-display :amount="config.annualAmount" /></p>
              <p class="reduction">
                Réduction: -<currency-display :amount="getScholarshipAmount()" />
              </p>
              <p class="final-amount">
                Montant après bourse: <currency-display :amount="getAdjustedAmount()" />
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
        Enregistrer
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { Student } from '@/types/card';
import { PaymentConfig } from '@/types/payment';
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

const form = ref<PaymentForm>({
  amount: 0,
  type: 'tuition',
  paymentMethod: 'cash',
  reference: '',
  comment: '',
  hasScholarship: props.student?.scholarshipPercentage ? true : false,
  scholarshipPercentage: props.student?.scholarshipPercentage || null
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


interface PaymentData {
  studentId: number;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  reference?: string;
  comment?: string;
  installmentNumber: number;
  schoolYear: string;
  scholarshipPercentage: number;
  scholarshipAmount: number;
  adjustedAmount: number;
  baseAmount: number;
}

const dialogTitle = computed(() => {
  return `Nouveau paiement - ${props.student?.firstname} ${props.student?.lastname}`;
});

const totalPaid = ref(0);

const remainingAmount = computed(() => {
  const annualAmount = props.config?.annualAmount || 0;
  const paid = totalPaid.value || 0;
  return Math.max(0, annualAmount - paid);
});

const getInitials = () => {
  if (!props.student?.firstname || !props.student?.lastname) return '';
  return `${props.student.firstname[0]}${props.student.lastname[0]}`.toUpperCase();
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    loading.value = true;

    const adjustedAmount = getAdjustedAmount();
    const scholarshipPercentage = form.value.hasScholarship ? Number(form.value.scholarshipPercentage) : 0;
    const scholarshipAmount = getScholarshipAmount();

    console.log('=== Vérification des données de bourse ===');
    console.log('Form hasScholarship:', form.value.hasScholarship);
    console.log('Form scholarshipPercentage:', form.value.scholarshipPercentage);
    console.log('Calculated scholarshipAmount:', scholarshipAmount);
    console.log('Calculated adjustedAmount:', adjustedAmount);

    const paymentData: PaymentData = {
      studentId: props.student?.id ?? 0,
      amount: form.value.amount,
      paymentType: form.value.type,
      paymentMethod: form.value.paymentMethod,
      reference: form.value.reference,
      comment: form.value.comment,
      installmentNumber: 1,
      schoolYear: new Date().getFullYear().toString(),
      scholarshipPercentage: scholarshipPercentage,
      scholarshipAmount: scholarshipAmount,
      adjustedAmount: adjustedAmount,
      baseAmount: props.config?.annualAmount || 0
    };

    console.log('=== Données finales du paiement ===');
    console.log(JSON.stringify(paymentData, null, 2));

    const result = await window.ipcRenderer.invoke('payment:create', paymentData);

    if (result?.success) {
      console.log('=== Résultat de la création du paiement ===');
      console.log('Succès:', result);
      console.log('============================');
      
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

const getMaxAmount = computed(() => {
  if (!props.config?.annualAmount) return 0;
  
  const baseAmount = props.config.annualAmount;
  if (!form.value.scholarshipPercentage) return baseAmount;
  
  return baseAmount * (1 - form.value.scholarshipPercentage / 100);
});

const getScholarshipAmount = () => {
  if (!form.value.hasScholarship || !form.value.scholarshipPercentage || !props.config?.annualAmount) {
    return 0;
  }
  return (props.config.annualAmount * form.value.scholarshipPercentage) / 100;
};

const getAdjustedAmount = () => {
  console.log('=== Calcul du montant ajusté ===');
  if (!props.config?.annualAmount) {
    console.log('Pas de montant annuel configuré');
    return 0;
  }
  
  const baseAmount = props.config.annualAmount;
  console.log('Montant de base:', baseAmount);
  
  if (!form.value.hasScholarship || !form.value.scholarshipPercentage) {
    console.log('Pas de bourse appliquée');
    return baseAmount;
  }
  
  const scholarshipAmount = getScholarshipAmount();
  const adjustedAmount = baseAmount - scholarshipAmount;
  
  console.log('Bourse activée:', form.value.hasScholarship);
  console.log('Pourcentage de bourse:', form.value.scholarshipPercentage);
  console.log('Montant de la réduction:', scholarshipAmount);
  console.log('Montant ajusté final:', adjustedAmount);
  
  return adjustedAmount;
};

// Ajouter un watcher pour voir les valeurs
watch(() => props.config, (newConfig) => {
  console.log('Config reçue dans le dialogue:', newConfig);
  console.log('allowScholarship:', newConfig?.allowScholarship);
  console.log('scholarshipPercentages:', newConfig?.scholarshipPercentages);
}, { immediate: true });

const { currency } = useCurrency();

// Mettre à jour la fonction loadPaymentData
const loadPaymentData = async () => {
  try {
    if (!props.student?.id) return;
    
    const result = await window.ipcRenderer.invoke('payment:getByStudent', props.student.id);
    console.log('Résultat des paiements:', result);
    
    if (result.success && result.data) {
      // Récupérer les paiements
      const payments = Array.isArray(result.data.payments) ? result.data.payments : [];
      
      // Calculer le total payé
      totalPaid.value = payments.reduce((sum, payment) => {
        return sum + (Number(payment.amount) || 0);
      }, 0);
      
      console.log('Total payé:', totalPaid.value);
      
      // Appliquer les informations de bourse si disponibles
      if (result.data.scholarshipPercentage > 0) {
        form.value.hasScholarship = true;
        form.value.scholarshipPercentage = result.data.scholarshipPercentage;
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des paiements:', error);
  }
};

// Appeler loadPaymentData quand le dialogue s'ouvre
watch(() => props.visible, (newValue) => {
  if (newValue) {
    loadPaymentData();
  }
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

.left-column {
  padding-right: 24px;
  border-right: 1px solid var(--el-border-color-lighter);
  overflow-y: auto;
}

.right-column {
  overflow-y: auto;
}

.payment-dialog :deep(.el-dialog__body) {
  padding: 20px;
  overflow: hidden;
}

.student-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.student-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.student-info h3 {
  margin: 0;
  font-size: 18px;
}

.matricule, .grade {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.payment-summary {
  margin-bottom: 24px;
}

.summary-card {
  background-color: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.summary-card .label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 8px;
}

.summary-card .value {
  font-size: 16px;
  font-weight: 600;
}

.summary-card .value.success {
  color: var(--el-color-success);
}

.summary-card .value.warning {
  color: var(--el-color-warning);
}

.payment-form {
  margin-top: 0;
}

.payment-preview {
  margin-top: 24px;
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.payment-preview h4 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-item.scholarship {
  color: var(--el-color-success);
}

.preview-item.total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
}

.scholarship-section {
  background-color: var(--el-fill-color-lighter);
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}
</style> 