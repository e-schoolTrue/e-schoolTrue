<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FormInstance, UploadFile } from 'element-plus';
import { ElMessage } from 'element-plus';

interface Props {
  visible: boolean;
  student?: Student | null;
  absence?: Absence | null;
}

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  grade: {
    id: number;
    name: string;
  };
}

interface Course {
  id: number;
  name: string;
  professor: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

interface Absence {
  id: number;
  date: Date;
  startTime?: string;
  endTime?: string;
  reason: string;
  reasonType: 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';
  absenceType: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'COURSE';
  justified: boolean;
  student: Student;
  course?: Course;
  justificationDocument?: string;
  comments?: string;
}

interface AbsenceFormData {
  studentId: number;
  gradeId: number;
  date: string;
  absenceType: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'COURSE';
  reasonType: 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';
  reason: string;
  justified: boolean;
  startTime: string | null;
  endTime: string | null;
  courseId: number | null;
  comments: string;
  justificationDocument?: string;
}

interface AbsenceSubmitData {
  studentId: number;
  gradeId: number;
  date: string;
  absenceType: "FULL_DAY" | "MORNING" | "AFTERNOON" | "COURSE";
  reasonType: "OTHER" | "MEDICAL" | "FAMILY" | "UNAUTHORIZED" | "SCHOOL_ACTIVITY";
  reason: string;
  justified: boolean;
  startTime: string | null;
  endTime: string | null;
  courseId: number | null;
  comments: string;
  justificationDocument?: string;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  student: null,
  absence: null
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: AbsenceFormData): void;
}>();

// États
const formRef = ref<FormInstance>();
const saving = ref(false);
const loadingStudents = ref(false);
const students = ref<Student[]>([]);
const availableCourses = ref<Course[]>([]);
const selectedFile = ref<UploadFile | null>(null);
const loadingCourses = ref(false);

// Formulaire
const form = ref<AbsenceFormData>({
  studentId: 0,
  gradeId: 0,
  date: new Date().toISOString(),
  absenceType: 'FULL_DAY',
  reasonType: 'OTHER',
  reason: '',
  justified: false,
  startTime: null,
  endTime: null,
  courseId: null,
  comments: '',
  justificationDocument: undefined,
});

// Options
const absenceTypes = [
  { value: 'FULL_DAY', label: 'Journée complète' },
  { value: 'MORNING', label: 'Matin' },
  { value: 'AFTERNOON', label: 'Après-midi' },
  { value: 'COURSE', label: 'Par cours' }
];

const reasonTypes = [
  { value: 'MEDICAL', label: 'Médical' },
  { value: 'FAMILY', label: 'Familial' },
  { value: 'UNAUTHORIZED', label: 'Non autorisé' },
  { value: 'SCHOOL_ACTIVITY', label: 'Activité scolaire' },
  { value: 'OTHER', label: 'Autre' }
];

// Déplacer la fonction validateTimes avant les règles
const validateTimes = (_: any, value: string | null, callback: any) => {
  if (form.value.absenceType === 'COURSE') {
    if (!value) {
      callback(new Error("L'heure est requise pour une absence par cours"));
      return;
    }
    
    if (form.value.startTime && form.value.endTime) {
      const start = new Date(`1970-01-01T${form.value.startTime}`);
      const end = new Date(`1970-01-01T${form.value.endTime}`);
      
      if (end <= start) {
        callback(new Error("L'heure de fin doit être après l'heure de début"));
        return;
      }
    }
  }
  callback();
};

// Règles de validation
const rules = {
  studentId: [{ required: true, message: "L'élève est requis", trigger: 'change' }],
  date: [{ required: true, message: 'La date est requise', trigger: 'change' }],
  absenceType: [{ required: true, message: "Le type d'absence est requis", trigger: 'change' }],
  reasonType: [{ required: true, message: 'Le type de motif est requis', trigger: 'change' }],
  reason: [{ required: false }],
  courseId: [{
    required: false,
    validator: (_: any, value: number | null) => {
      if (form.value.absenceType === 'COURSE' && !value) {
        return Promise.reject("Le cours est requis pour une absence par cours");
      }
      return Promise.resolve();
    },
    trigger: 'change'
  }],
  startTime: [{
    validator: validateTimes,
    trigger: 'change'
  }],
  endTime: [{
    validator: validateTimes,
    trigger: 'change'
  }]
};

// Ajouter des tooltips d'aide
const tooltips = {
  absenceType: "Sélectionnez le type d'absence approprié",
  reasonType: "Catégorisez le motif de l'absence",
  reason: "Description optionnelle pour plus de détails",
  justified: "Cochez si l'absence est justifiée par un document",
};

// Computed
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const isEdit = computed(() => !!props.absence);

// Méthodes
const searchStudents = async (query: string) => {
  if (query.length < 2) return;
  
  loadingStudents.value = true;
  try {
    const result = await window.ipcRenderer.invoke('student:search', query);
    if (result?.success) {
      students.value = result.data;
    }
  } catch (error) {
    ElMessage.error("Erreur lors de la recherche des élèves");
  } finally {
    loadingStudents.value = false;
  }
};

const loadStudentCourses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('course:all');
    if (result?.success) {
      availableCourses.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des cours:', error);
    ElMessage.error('Erreur lors du chargement des cours');
  }
};

const handleStudentChange = async (studentId: number) => {
  if (!studentId) {
    availableCourses.value = [];
    return;
  }

  try {
    loadingCourses.value = true;
    const student = students.value.find(s => s.id === studentId);
    if (student?.grade?.id) {
      await loadStudentCourses();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des cours:', error);
    ElMessage.error('Erreur lors du chargement des cours');
  } finally {
    loadingCourses.value = false;
  }
};

const handleAbsenceTypeChange = (type: string) => {
  if (type !== 'COURSE') {
    form.value.courseId = null;
    form.value.startTime = null;
    form.value.endTime = null;
  }
};

const handleFileChange = (uploadFile: UploadFile) => {
  selectedFile.value = uploadFile;
};

const disablePastDates = (date: Date) => {
  return date < new Date(new Date().setHours(0, 0, 0, 0));
};

const handleCancel = () => {
  dialogVisible.value = false;
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    saving.value = true;

    const student = students.value.find(s => s.id === form.value.studentId);
    if (!student || !student.grade) {
      ElMessage.error("Informations de l'étudiant incomplètes");
      return;
    }

    // Créer un objet simple sans méthodes ou références circulaires
    const submitData: AbsenceSubmitData = {
      studentId: student.id,
      gradeId: student.grade.id,
      date: new Date(form.value.date).toISOString(),
      absenceType: form.value.absenceType,
      reasonType: form.value.reasonType,
      reason: form.value.reason.trim(),
      justified: Boolean(form.value.justified),
      startTime: form.value.startTime ? formatTime(form.value.startTime) : null,
      endTime: form.value.endTime ? formatTime(form.value.endTime) : null,
      courseId: form.value.courseId,
      comments: form.value.comments.trim()
    };

    // Gérer le fichier justificatif si présent
    if (selectedFile.value?.raw) {
      const fileResult = await window.ipcRenderer.invoke('file:upload', {
        file: selectedFile.value.raw,
        type: 'JUSTIFICATION'
      });

      if (fileResult?.success) {
        submitData.justificationDocument = fileResult.data.path;
      }
    }

    const result = await window.ipcRenderer.invoke('absence:add', submitData);
    
    if (result?.success) {
      ElMessage.success("Absence ajoutée avec succès");
      dialogVisible.value = false;
      emit('submit', submitData);
    } else {
      throw new Error(result?.error || "Erreur lors de l'ajout de l'absence");
    }

  } catch (error) {
    console.error('Erreur lors de la soumission:', error);
    ElMessage.error(error instanceof Error ? error.message : "Erreur lors de la soumission");
  } finally {
    saving.value = false;
  }
};
// Initialisation en mode édition
watch(() => props.absence, (newAbsence) => {
  if (newAbsence) {
    form.value = {
      studentId: newAbsence.student.id,
      date: newAbsence.date ? new Date(newAbsence.date).toISOString() : '',
      absenceType: newAbsence.absenceType,
      reasonType: newAbsence.reasonType,
      reason: newAbsence.reason,
      justified: newAbsence.justified,
      startTime: newAbsence.startTime || null,
      endTime: newAbsence.endTime || null,
      courseId: newAbsence.course?.id || null,
      comments: newAbsence.comments || '',
      gradeId: newAbsence.student.grade?.id || 0
    };
  }
}, { immediate: true });

// fonction utilitaire pour formater l'heure
const formatTime = (time: Date | string | null): string => {
  if (!time) return '';
  
  try {
    if (time instanceof Date) {
      return time.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    
    if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
      return time;
    }
    
    const date = new Date(time);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '';
  }
};
</script>

<template>
  <el-dialog
    :title="isEdit ? 'Modifier une absence' : 'Nouvelle absence'"
    v-model="dialogVisible"
    width="700px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="absence-form"
    >
      <!-- Section Informations principales -->
      <div class="form-section">
        <h3>Informations principales</h3>
      <!-- Sélection de l'élève -->
        <el-form-item 
          label="Élève" 
          prop="studentId" 
          v-if="!isEdit"
          :tooltip="tooltips.absenceType"
        >
        <el-select
          v-model="form.studentId"
          filterable
          remote
          :remote-method="searchStudents"
          :loading="loadingStudents"
          placeholder="Rechercher un élève"
          @change="handleStudentChange"
        >
          <el-option
            v-for="student in students"
            :key="student.id"
            :label="`${student.firstname} ${student.lastname} (${student.matricule})`"
            :value="student.id"
          >
            <div class="student-option">
              <span>{{ student.firstname }} {{ student.lastname }}</span>
              <small>
                {{ student.matricule }} - {{ student.grade?.name }}
              </small>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

        <!-- Type d'absence avec tooltip -->
        <el-form-item 
          label="Type d'absence" 
          prop="absenceType"
          :tooltip="tooltips.absenceType"
        >
        <el-select
          v-model="form.absenceType"
          placeholder="Sélectionner le type"
          @change="handleAbsenceTypeChange"
        >
          <el-option
            v-for="type in absenceTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>

        <!-- Date et heures dans une grille responsive -->
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="Date" prop="date">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="Sélectionner la date"
            :disabled-date="disablePastDates"
          />
        </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" v-if="form.absenceType === 'COURSE'">
            <el-row :gutter="10">
              <el-col :span="12">
                <el-form-item label="Début" prop="startTime">
            <el-time-picker
              v-model="form.startTime"
              format="HH:mm"
              placeholder="Heure début"
            />
          </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Fin" prop="endTime">
            <el-time-picker
              v-model="form.endTime"
              format="HH:mm"
              placeholder="Heure fin"
            />
          </el-form-item>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </div>

      <!-- Section Motif -->
      <div class="form-section">
        <h3>Motif et Justification</h3>
      <el-form-item
          label="Type de motif" 
          prop="reasonType"
          :tooltip="tooltips.reasonType"
        >
        <el-select
          v-model="form.reasonType"
          placeholder="Sélectionner le motif"
        >
          <el-option
            v-for="type in reasonTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>

        <el-form-item 
          label="Description (optionnelle)" 
          prop="reason"
          :tooltip="tooltips.reason"
        >
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
            placeholder="Détails additionnels sur le motif de l'absence (optionnel)"
        />
      </el-form-item>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="8">
            <el-form-item 
              label="Justifiée" 
              :tooltip="tooltips.justified"
            >
          <el-switch v-model="form.justified" />
        </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="16" v-if="form.justified">
        <el-form-item
          label="Document justificatif"
          prop="justificationDocument"
        >
          <el-upload
            class="upload-doc"
            :auto-upload="false"
            :show-file-list="true"
            :limit="1"
            accept=".pdf,.jpg,.jpeg,.png"
            @change="handleFileChange"
          >
            <template #trigger>
              <el-button type="primary">Sélectionner</el-button>
            </template>
          </el-upload>
        </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Commentaires -->
      <el-form-item label="Commentaires" prop="comments">
        <el-input
          v-model="form.comments"
          type="textarea"
          :rows="2"
          placeholder="Commentaires additionnels"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">Annuler</el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="saving"
        >
          {{ isEdit ? 'Modifier' : 'Ajouter' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.absence-form {
  max-height: 70vh;
  overflow-y: auto;
  padding: 0 16px;
}

.form-section {
  background-color: var(--el-fill-color-blank);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--el-box-shadow-lighter);
}

.form-section h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 10px;
}

.form-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.date-input {
  flex: 2;
}

.time-input {
  flex: 1;
}

.justify-switch {
  flex: 1;
}

.student-option,
.course-option {
  display: flex;
  flex-direction: column;
}

.student-option small,
.course-option small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.upload-doc {
  :deep(.el-upload-list) {
    margin-top: 8px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>