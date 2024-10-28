<template>
  <el-card class="absence-form">
    <template #header>
      <h3>Ajouter une absence</h3>
    </template>
    <el-form :model="form" @submit.prevent="submitForm" label-position="top">
      <el-form-item label="ID Étudiant" prop="studentId">
        <el-input v-model.number="form.studentId" type="number" placeholder="Entrez l'ID de l'étudiant" />
      </el-form-item>
      <el-form-item label="Date" prop="date">
        <el-date-picker v-model="form.date" type="date" placeholder="Sélectionnez une date" style="width: 100%;" />
      </el-form-item>
      <el-form-item label="Raison" prop="reason">
        <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="Entrez la raison de l'absence" />
      </el-form-item>
      <el-form-item label="Justifiée" prop="justified">
        <el-switch v-model="form.justified" active-text="Oui" inactive-text="Non" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="isSubmitting">Ajouter l'absence</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const form = ref({
  studentId: null as number | null,
  date: null as Date | null,
  reason: '',
  justified: false
});

const isSubmitting = ref(false);

const emit = defineEmits(['absence-added']);

const submitForm = async () => {
  if (!form.value.studentId || !form.value.date || !form.value.reason) {
    ElMessage.warning('Veuillez remplir tous les champs obligatoires');
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await window.ipcRenderer.invoke('absence:add', form.value);
    if (result.success) {
      emit('absence-added', result.data);
      ElMessage.success("L'absence a été ajoutée avec succès");
      form.value = { studentId: null, date: null, reason: '', justified: false };
    } else {
      ElMessage.error(result.message || "Erreur lors de l'ajout de l'absence");
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'absence:", error);
    ElMessage.error("Une erreur s'est produite lors de l'ajout de l'absence");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.absence-form {
  max-width: 500px;
  margin: 0 auto;
}
</style>
