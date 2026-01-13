<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FormInstance, UploadFile } from 'element-plus';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

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
  document?: {
    content: string;
    name: string;
    type: string;
  };
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
      throw new Error("Informations de l'étudiant incomplètes");
    }

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

    // Gestion du document en une seule fois
    if (selectedFile.value?.raw) {
      const fileBuffer = await selectedFile.value.raw.arrayBuffer();
      submitData.document = {
        content: btoa(
          new Uint8Array(fileBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        ),
        name: selectedFile.value.raw.name,
        type: 'JUSTIFICATION'
      };
    }

    const result = await window.ipcRenderer.invoke('absence:add', submitData);
    console.log(result);
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
    v-model="dialogVisible"
    :title="isEdit ? 'Modifier une absence' : 'Nouvelle absence'"
    width="95%"
    :close-on-click-modal="false"
    destroy-on-close
    class="absence-dialog"
    top="5vh"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="absence-form"
      :scroll-to-error="true"
    >
      <!-- Layout en 2 colonnes principales -->
      <el-row :gutter="24">
        <!-- Colonne Gauche : Informations principales -->
        <el-col :xs="24" :lg="12">
          <div class="form-section">
            <div class="section-header">
              <Icon icon="mdi:information-outline" class="section-icon" />
              <h3>Informations principales</h3>
            </div>

            <!-- Sélection de l'élève -->
            <el-form-item 
              v-if="!isEdit"
              label="Élève" 
              prop="studentId"
            >
              <el-select
                v-model="form.studentId"
                filterable
                remote
                :remote-method="searchStudents"
                :loading="loadingStudents"
                placeholder="Rechercher un élève (nom, prénom ou matricule)"
                @change="handleStudentChange"
                size="large"
                class="full-width"
              >
                <template #prefix>
                  <Icon icon="mdi:account-search" />
                </template>
                <el-option
                  v-for="student in students"
                  :key="student.id"
                  :label="`${student.firstname} ${student.lastname} (${student.matricule})`"
                  :value="student.id"
                >
                  <div class="student-option">
                    <div class="student-option-main">
                      <Icon icon="mdi:account" />
                      <span class="student-name">{{ student.firstname }} {{ student.lastname }}</span>
                    </div>
                    <small class="student-meta">
                      {{ student.matricule }} • {{ student.grade?.name }}
                    </small>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>

            <!-- Type d'absence -->
            <el-form-item 
              label="Type d'absence" 
              prop="absenceType"
            >
              <el-select
                v-model="form.absenceType"
                placeholder="Sélectionner le type"
                @change="handleAbsenceTypeChange"
                size="large"
                class="full-width"
              >
                <template #prefix>
                  <Icon icon="mdi:calendar-clock" />
                </template>
                <el-option
                  v-for="type in absenceTypes"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
            </el-form-item>

            <!-- Date -->
            <el-form-item label="Date" prop="date">
              <el-date-picker
                v-model="form.date"
                type="date"
                placeholder="Sélectionner la date"
                :disabled-date="disablePastDates"
                size="large"
                class="full-width"
                format="DD/MM/YYYY"
              >
                <template #prefix>
                  <Icon icon="mdi:calendar" />
                </template>
              </el-date-picker>
            </el-form-item>

            <!-- Heures (si absence par cours) -->
            <el-row v-if="form.absenceType === 'COURSE'" :gutter="16" class="time-section">
              <el-col :span="12">
                <el-form-item label="Heure de début" prop="startTime">
                  <el-time-picker
                    v-model="form.startTime"
                    format="HH:mm"
                    placeholder="Heure début"
                    size="large"
                    class="full-width"
                  >
                    <template #prefix>
                      <Icon icon="mdi:clock-start" />
                    </template>
                  </el-time-picker>
                </el-form-item>
              </el-col>

              <el-col :span="12">
                <el-form-item label="Heure de fin" prop="endTime">
                  <el-time-picker
                    v-model="form.endTime"
                    format="HH:mm"
                    placeholder="Heure fin"
                    size="large"
                    class="full-width"
                  >
                    <template #prefix>
                      <Icon icon="mdi:clock-end" />
                    </template>
                  </el-time-picker>
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-col>

        <!-- Colonne Droite : Motif et Justification -->
        <el-col :xs="24" :lg="12">
          <div class="form-section">
            <div class="section-header">
              <Icon icon="mdi:clipboard-text-outline" class="section-icon" />
              <h3>Motif et Justification</h3>
            </div>

            <!-- Type de motif -->
            <el-form-item label="Type de motif" prop="reasonType">
              <el-select
                v-model="form.reasonType"
                placeholder="Sélectionner le motif"
                size="large"
                class="full-width"
              >
                <template #prefix>
                  <Icon icon="mdi:tag-outline" />
                </template>
                <el-option
                  v-for="type in reasonTypes"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
            </el-form-item>

            <!-- Description -->
            <el-form-item 
              label="Description détaillée" 
              prop="reason"
            >
              <el-input
                v-model="form.reason"
                type="textarea"
                :rows="2"
                placeholder="Décrivez les détails de l'absence (optionnel)"
                show-word-limit
                maxlength="500"
              />
            </el-form-item>

            <!-- Justification -->
            <div class="justification-section">
              <el-row :gutter="16" align="middle">
                <el-col :span="8">
                  <el-form-item class="justify-switch-item">
                    <template #label>
                      <div class="switch-label">
                        <Icon icon="mdi:check-circle-outline" />
                        <span>Justifiée</span>
                      </div>
                    </template>
                    <el-switch 
                      v-model="form.justified"
                      size="large"
                      active-text="Oui"
                      inactive-text="Non"
                    />
                  </el-form-item>
                </el-col>
                
                <el-col :span="16" v-if="form.justified">
                  <el-form-item
                    label="Document justificatif"
                    prop="justificationDocument"
                    class="upload-section"
                  >
                    <el-upload
                      class="upload-doc"
                      :auto-upload="false"
                      :show-file-list="true"
                      :limit="1"
                      accept=".pdf,.jpg,.jpeg,.png"
                      @change="handleFileChange"
                      drag
                    >
                      <div class="upload-content-compact">
                        <Icon icon="mdi:cloud-upload-outline" class="upload-icon-small" />
                        <div class="upload-text-compact">
                          <p class="upload-main-compact">Glissez le document ou cliquez</p>
                          <p class="upload-hint-compact">PDF, JPG, PNG (max 10MB)</p>
                        </div>
                      </div>
                    </el-upload>
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-col>
      </el-row>

    
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel" size="large">
          <Icon icon="mdi:close" class="btn-icon" />
          Annuler
        </el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="saving"
          size="large"
        >
          <Icon v-if="!saving" icon="mdi:check" class="btn-icon" />
          {{ isEdit ? 'Modifier' : 'Enregistrer' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* Dialog principal */
:deep(.absence-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.absence-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 30px;
  margin: 0;
}

:deep(.absence-dialog .el-dialog__title) {
  color: white;
  font-size: 20px;
  font-weight: 600;
}

:deep(.absence-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: white;
  font-size: 20px;
}

:deep(.absence-dialog .el-dialog__body) {
  padding: 16px 20px;
  background: #f8f9fa;
}

/* Formulaire */
.absence-form {
  padding: 0;
  overflow: visible;
}


/* Sections du formulaire */
.form-section {
  background: white;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  height: 100%;
}

.form-section:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #f0f0f0;
}

.section-icon {
  font-size: 22px;
  color: #667eea;
  flex-shrink: 0;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* Inputs et selects */
.full-width {
  width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-select .el-input__wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

:deep(.el-form-item) {
  margin-bottom: 16px;
}

/* Options des selects */
.student-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
}

.student-option-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.student-option-main .iconify {
  color: var(--el-color-primary);
  font-size: 16px;
}

.student-name {
  color: var(--el-text-color-primary);
}

.student-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  padding-left: 24px;
}

/* Section horaires */
.time-section {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Justification section */
.justification-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.justify-switch-item {
  margin-bottom: 0;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.switch-label .iconify {
  color: var(--el-color-success);
  font-size: 18px;
}

:deep(.justify-switch-item .el-switch) {
  --el-switch-on-color: var(--el-color-success);
}

/* Upload section */
.upload-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.upload-doc {
  width: 100%;
}

:deep(.upload-doc .el-upload-dragger) {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  background: white;
  padding: 30px;
  transition: all 0.3s ease;
}

:deep(.upload-doc .el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 48px;
  color: var(--el-color-primary);
}

.upload-text {
  text-align: center;
}

.upload-main {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0 0 4px 0;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

:deep(.upload-doc .el-upload-list) {
  margin-top: 12px;
}

:deep(.upload-doc .el-upload-list__item) {
  border-radius: 6px;
  background: #f8f9fa;
}

/* Version compacte de l'upload pour layout 2 colonnes */
.upload-content-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.upload-icon-small {
  font-size: 32px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.upload-text-compact {
  text-align: left;
  flex: 1;
}

.upload-main-compact {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0 0 2px 0;
}

.upload-hint-compact {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

:deep(.upload-doc .el-upload-dragger) {
  padding: 12px;
  min-height: auto;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0;
}

.dialog-footer .el-button {
  min-width: 120px;
  border-radius: 8px;
  font-weight: 500;
}

.btn-icon {
  margin-right: 6px;
  font-size: 18px;
}

/* Responsive */
@media (max-width: 1200px) {
  :deep(.absence-dialog) {
    width: 95% !important;
  }
}

@media (max-width: 768px) {
  :deep(.absence-dialog) {
    width: 98% !important;
    margin: 0;
  }

  :deep(.absence-dialog .el-dialog__body) {
    padding: 12px;
  }

  .form-section {
    padding: 12px;
    margin-bottom: 12px;
  }

  .section-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }

  .section-header h3 {
    font-size: 15px;
  }

  .upload-content-compact {
    flex-direction: column;
    text-align: center;
  }

  .upload-text-compact {
    text-align: center;
  }
}

/* Ajustement du dialog pour maximiser l'espace */
:deep(.absence-dialog .el-dialog) {
  max-width: 1400px;
  margin: 0 auto;
}

/* Animations pour les transitions */
:deep(.el-form-item) {
  transition: all 0.3s ease;
}

:deep(.el-input.is-focus .el-input__wrapper),
:deep(.el-select.is-focus .el-input__wrapper),
:deep(.el-textarea.is-focus .el-textarea__inner) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

/* Amélioration des tags dans les options */
:deep(.el-select-dropdown__item) {
  padding: 10px 20px;
  transition: all 0.2s ease;
}

:deep(.el-select-dropdown__item:hover) {
  background: var(--el-fill-color-light);
}
</style>