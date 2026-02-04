<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { ICourseBase, ICourseFormData, ICourseGroupFormData } from '@/types/course';
import { Grade } from '@/types/grade';

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
const grades = ref<Grade[]>([]);

// Définir une interface locale pour l'état du formulaire qui étend ICourseBase
// et inclut toujours groupementId comme optionnel pour la réactivité du formulaire.
interface FormState extends ICourseBase {
  groupementId?: number; // Rendre groupementId explicitement optionnel ici pour l'état interne du formulaire
  gradeIds?: number[]; // Tableau pour les classes multiples
}

const form = reactive<FormState>({
  name: '',
  code: '',
  coefficient: 1,
  gradeId: undefined,
  gradeIds: [],
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
  ],
  gradeIds: [
    { 
      required: true, 
      message: 'Au moins une classe est requise', 
      trigger: 'change',
      validator: (_, value, callback) => {
        if (!value || value.length === 0) {
          callback(new Error('Au moins une classe est requise'));
        } else {
          callback();
        }
      }
    }
  ]
});

const openDialog = (initialData?: any) => {
  if (initialData) {
    form.id = initialData.id;
    form.name = initialData.name;
    form.code = initialData.code;
    form.coefficient = initialData.coefficient;
    
    // Gérer les grades (multiple ou simple)
    if (initialData.grades && Array.isArray(initialData.grades)) {
      form.gradeIds = initialData.grades.map((g: any) => g.id);
    } else if (initialData.gradeId) {
      form.gradeIds = [initialData.gradeId];
    } else {
      form.gradeIds = [];
    }
    
    if (props.isGroupement && 'groupementId' in initialData) {
      form.groupementId = initialData.groupementId;
    }
  } else {
    form.id = undefined;
    form.name = '';
    form.code = '';
    form.coefficient = 1;
    form.gradeIds = [];
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
    let formDataToSend: any;

    if (props.isGroupement) {
      if (typeof form.groupementId !== 'number') {
        ElMessage.error('ID de groupement est requis pour un cours groupé.');
        return;
      }
      formDataToSend = {
        id: form.id,
        name: form.name,
        code: form.code,
        coefficient: form.coefficient,
        groupementId: form.groupementId,
      };
    } else {
      formDataToSend = {
        id: form.id,
        name: form.name,
        code: form.code,
        coefficient: form.coefficient,
        gradeIds: form.gradeIds,
      };
    }
    emit('submit', formDataToSend);
    closeDialog();
  } catch (error) {
    ElMessage.error('Veuillez corriger les erreurs dans le formulaire');
  }
};

const fetchGrades = async () => {
  try {
    const response = await window.ipcRenderer.invoke('grade:all');
    if (response.success) {
      grades.value = response.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classes:', error);
  }
};

onMounted(fetchGrades);

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

      <el-form-item label="Classes" prop="gradeIds">
        <el-select 
          v-model="form.gradeIds" 
          placeholder="Sélectionner une ou plusieurs classes" 
          style="width: 100%"
          multiple
          collapse-tags
          collapse-tags-tooltip
        >
          <el-option
            v-for="grade in grades"
            :key="grade.id"
            :value="grade.id"
            :label="`${grade.name} (${grade.code})`"
          />
        </el-select>
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