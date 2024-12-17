<template>
  <div>
    <h3>Informations Académiques</h3>
    <el-form-item label="Classe">
      <el-select v-model="formData.gradeId" placeholder="Sélectionnez une classe">
        <el-option
          v-for="classItem in safeClasses"
          :key="classItem?.id"
          :label="classItem?.name"
          :value="classItem?.id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="Année Scolaire">
      <el-input 
        v-model="formData.schoolYear" 
        placeholder="Année scolaire"
        disabled
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

interface ClassItem {
  id: number;
  name: string;
}

interface Props {
  formData: {
    gradeId: number | null;
    schoolYear: string;
  };
  classes: ClassItem[];
}

const props = withDefaults(defineProps<Props>(), {
  classes: () => [],
  formData: () => ({
    gradeId: null,
    schoolYear: ''
  })
});

const safeClasses = computed(() => {
  return Array.isArray(props.classes) ? props.classes : [];
});

const fetchCurrentSchoolYear = async () => {
  try {
    const result = await window.ipcRenderer.invoke("yearRepartition:getCurrent");
    if (result.success && result.data) {
      props.formData.schoolYear = result.data.schoolYear;
    } else {
      ElMessage.warning("Aucune année scolaire active n'a été trouvée");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'année scolaire:", error);
    ElMessage.error("Impossible de récupérer l'année scolaire");
  }
};

onMounted(fetchCurrentSchoolYear);
</script>