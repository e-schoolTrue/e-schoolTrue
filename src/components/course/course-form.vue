<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { ICourseBase, ICourseFormData, ICourseGroupFormData } from '@/types/course';

const props = defineProps<{
  isGroupement?: boolean;
  initialData?: ICourseFormData | ICourseGroupFormData;
  groupementId?: number;
}>();

const emit = defineEmits<{
  (e: 'submit', data: ICourseFormData | ICourseGroupFormData): void;
  (e: 'close'): void;
}>();

const formRef = ref<FormInstance>();
const dialogVisible = ref(false);

// Définir une interface locale pour l'état du formulaire qui étend ICourseBase
// et inclut toujours groupementId comme optionnel pour la réactivité du formulaire.
interface FormState extends ICourseBase {
  groupementId?: number; // Rendre groupementId explicitement optionnel ici pour l'état interne du formulaire
}

const form = reactive<FormState>({
  name: '',
  code: '',
  coefficient: 1,
  // Initialiser groupementId en fonction de props.isGroupement
  groupementId: props.isGroupement ? props.groupementId : undefined,
});

const rules = reactive<FormRules>({
  name: [
    { required: true, message: 'Le nom est requis', trigger: 'blur' },
    { min: 2, message: 'Le nom doit contenir au moins 2 caractères', trigger: 'blur' }
  ],
  code: [
    { required: true, message: 'Le code est requis', trigger: 'blur' },
    { pattern: /^[A-Z0-9]{2,10}$/, message: 'Le code doit contenir entre 2 et 10 caractères alphanumériques majuscules', trigger: 'blur' }
  ],
  coefficient: [
    { required: true, message: 'Le coefficient est requis', trigger: 'blur' },
    { type: 'number', min: 0.1, max: 10, message: 'Le coefficient doit être entre 0.1 et 10', trigger: 'blur' }
  ]
});

const openDialog = (initialData?: ICourseFormData | ICourseGroupFormData) => {
  if (initialData) {
    form.id = initialData.id;
    form.name = initialData.name;
    form.code = initialData.code;
    form.coefficient = initialData.coefficient;
    if (props.isGroupement && 'groupementId' in initialData) {
      form.groupementId = initialData.groupementId;
    }
  } else {
    form.id = undefined;
    form.name = '';
    form.code = '';
    form.coefficient = 1;
    if (props.isGroupement) {
      form.groupementId = props.groupementId;
    }
  }
  dialogVisible.value = true;
};

const closeDialog = () => {
  dialogVisible.value = false;
  emit('close');
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
    let formDataToSend: ICourseFormData | ICourseGroupFormData;

    if (props.isGroupement) {
      if (typeof form.groupementId !== 'number') { // S'assurer qu'il est défini et est un nombre
        ElMessage.error('ID de groupement est requis pour un cours groupé.');
        return;
      }
      formDataToSend = { // Ceci correspondra à ICourseGroupFormData
        id: form.id,
        name: form.name,
        code: form.code,
        coefficient: form.coefficient,
        groupementId: form.groupementId,
      };
    } else {
      formDataToSend = { // Ceci correspondra à ICourseFormData
        id: form.id,
        name: form.name,
        code: form.code,
        coefficient: form.coefficient,
      };
    }
    emit('submit', formDataToSend);
    closeDialog();
  } catch (error) {
    ElMessage.error('Veuillez corriger les erreurs dans le formulaire');
  }
};

defineExpose({
  openDialog,
  closeDialog
});
</script>

<template>
  <el-dialog
    :title="isGroupement ? 'Ajouter un cours au groupement' : 'Ajouter un cours'"
    v-model="dialogVisible"
    width="500px"
    @close="closeDialog"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="Nom du cours" prop="name">
        <el-input v-model="form.name" placeholder="Entrez le nom du cours" />
      </el-form-item>

      <el-form-item label="Code du cours" prop="code">
        <el-input 
          v-model="form.code" 
          placeholder="Entrez le code du cours"
          :maxlength="10"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="Coefficient" prop="coefficient">
        <el-input-number
          v-model="form.coefficient"
          :min="0.1"
          :max="10"
          :step="0.1"
          :precision="1"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Annuler</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ isGroupement ? 'Ajouter au groupement' : 'Ajouter' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>