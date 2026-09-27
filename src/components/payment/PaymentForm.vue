<template>
  <el-form :model="form" @submit.prevent="submitForm" label-position="top" class="payment-form">
    <el-card class="payment-details-card">
      <template #header>
        <h3 class="card-title">Détails du paiement</h3>
      </template>
      <div class="form-grid">
        <el-form-item label="Montant" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :max="configData?.annualAmount || 0" :step="getInstallmentAmount()" class="full-width"/>
          <div class="help-text">Max: <currency-display :amount="configData?.annualAmount || 0" /></div>
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
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { ensureUnlock, isAccountingLockError, isNoSecretError, mapAccountingError } from '@/composables/useAccountingGuard';
import { strictInvoke } from '@/utils/ipc';
import { useRouter } from 'vue-router';
import { useYearStore } from '@/stores/yearStore';

const router = useRouter();

function uuidv4(): string {
  const c = window.crypto as unknown as { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Normalise le mode de saisie (cash/cheque/transfer) vers le référentiel backend (cash/check/transfer). */
function normalizePaymentMethod(raw: string): string {
  const v = (raw || '').toLowerCase();
  if (v === 'cheque' || v === 'check') return 'check';
  if (v === 'transfer') return 'transfer';
  return 'cash';
}

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
    const now = new Date();
    // Verrou année scolaire : le paiement est rattaché à l'année du login (readonly).
    const loginSchoolYear = useYearStore().currentSchoolYear;
    // Rétro-compat : reference/paymentDate n'ont pas de colonne payments dédiée.
    // On les reporte dans `comment` (persisté) tout en les envoyant séparément
    // pour cash_movements.reference/movementDate côté backend. Jamais de perte silencieuse.
    const refTag = form.value.reference?.trim() ? `[Réf: ${form.value.reference.trim()}]` : '';
    const enrichedNotes = [form.value.notes?.trim(), refTag].filter(Boolean).join(' | ') || undefined;
    const paymentData = {
      studentId: props.studentData.id,
      amount: Number(form.value.amount),
      // Type métier par défaut (le formulaire ne saisit que le mode).
      paymentType: 'tuition',
      paymentMethod: normalizePaymentMethod(form.value.paymentType),
      reference: form.value.reference || undefined,
      comment: enrichedNotes,
      installmentNumber: Number(form.value.installmentNumber),
      paymentDate: now.toISOString(),
      schoolYear: loginSchoolYear || undefined,
    };

    // Garde mot de passe comptable avant CHAQUE saisie (STRICT : force + frais, modale systématique).
    // Messages distincts conservés (NO_SECRET / LOCK / FRESH) — jamais de toast générique.
    try {
      await ensureUnlock({ force: true, fresh: true });
    } catch (guardErr) {
      if (isNoSecretError(guardErr)) {
        ElMessage.warning(mapAccountingError(guardErr));
        void router.push('/comptabilite/setup');
      } else if (isAccountingLockError(guardErr)) {
        ElMessage.warning(mapAccountingError(guardErr));
      }
      throw guardErr;
    }

    // Clé générée UNE fois : le rejeu sur verrouillage réutilise le même objet.
    // receiptNumber optionnel : omis ici, le backend génère R-YYYY-NNNN (compteur atomique).
    const payloadWithKey = { ...paymentData, idempotencyKey: uuidv4() };
    let data: unknown;
    try {
      data = await strictInvoke('payment:create', payloadWithKey);
    } catch (ipcErr) {
      if (!isAccountingLockError(ipcErr)) throw ipcErr;
      await ensureUnlock({ force: true, fresh: true });
      data = await strictInvoke('payment:create', payloadWithKey);
    }

    if (data !== undefined && data !== null) {
      emit('payment-added', data);
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
      throw new Error("Erreur lors de l'enregistrement du paiement");
    }
  } catch (error) {
    // Erreur détaillée (RBAC/security + verrou comptable) : ne pas masquer sous un toast générique.
    // NO_SECRET déjà notifié + redirection : pas de 2e toast générique.
    if (isNoSecretError(error)) {
      console.warn("[payment-form] abandon (NO_SECRET_SET déjà notifié).");
      return;
    }
    const raw = error instanceof Error ? error.message : String(error ?? '');
    const detail = isAccountingLockError(error) ? mapAccountingError(error) : raw;
    console.error("[payment-form] Échec enregistrement:", {
      studentId: props.studentData.id,
      amount: form.value.amount,
      reference: form.value.reference,
      notes: form.value.notes,
      detail: raw,
      error,
    });
    ElMessage({
      message: detail || "Une erreur s'est produite lors de l'enregistrement",
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