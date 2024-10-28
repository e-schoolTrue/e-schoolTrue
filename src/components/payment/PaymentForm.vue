<template>
  <el-card class="payment-form">
    <template #header>
      <h3>Ajouter un paiement</h3>
    </template>
    <el-form :model="form" @submit.prevent="submitForm" label-position="top">
      <el-form-item label="ID Étudiant" prop="studentId">
        <el-input v-model.number="form.studentId" type="number" placeholder="Entrez l'ID de l'étudiant" />
      </el-form-item>
      <el-form-item label="Montant" prop="amount">
        <el-input-number v-model="form.amount" :precision="2" :step="0.01" :min="0" style="width: 100%;" />
      </el-form-item>
      <el-form-item label="Type de paiement" prop="paymentType">
        <el-select v-model="form.paymentType" placeholder="Sélectionnez le type de paiement" style="width: 100%;">
          <el-option label="Frais de scolarité" value="tuition" />
          <el-option label="Frais d'inscription" value="registration" />
          <el-option label="Frais de cantine" value="canteen" />
          <el-option label="Frais de transport" value="transport" />
          <el-option label="Autre" value="other" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="isSubmitting">Ajouter le paiement</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const form = ref({
  studentId: null as number | null,
  amount: null as number | null,
  paymentType: ''
});

const isSubmitting = ref(false);

const emit = defineEmits(['payment-added']);

const submitForm = async () => {
  if (!form.value.studentId || !form.value.amount || !form.value.paymentType) {
    ElMessage.warning('Veuillez remplir tous les champs');
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await window.ipcRenderer.invoke('payment:add', form.value);
    if (result.success) {
      emit('payment-added', result.data);
      ElMessage.success('Paiement ajouté avec succès');
      form.value = { studentId: null, amount: null, paymentType: '' };
    } else {
      ElMessage.error(result.message || "Erreur lors de l'ajout du paiement");
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout du paiement:", error);
    ElMessage.error("Une erreur s'est produite lors de l'ajout du paiement");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.payment-form {
  max-width: 500px;
  margin: 0 auto;
}
</style>
