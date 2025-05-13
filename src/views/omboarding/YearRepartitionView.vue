<script setup lang="ts">

import { ref, computed, defineEmits, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Plus, Delete, Calendar } from '@element-plus/icons-vue';
import WizardViewBase from './WizardViewBase.vue';
import { Loader } from "@/components/util/AppLoader.ts";

// --- Interface pour une période ---
interface PeriodConfig {
  id: number;
  name: string;
  start: string | null; 
  end: string | null;   
  type: 'trimestre' | 'semestre';
}


const formatDateToString = (date: Date | null): string | null => {
  if (!date || isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- State ---
const emit = defineEmits(['configuration-saved', 'go-back']);
const formRef = ref<FormInstance>();
const academicYearStart = ref<string | null>(null); // Sera une string YYYY-MM-DD ou null
const academicYearEnd = ref<string | null>(null);   // Sera une string YYYY-MM-DD ou null
const periodConfigurations = ref<PeriodConfig[]>([]);
const periodType = ref<'trimestre' | 'semestre'>('trimestre');
let nextPeriodId = ref(1);
const isSaving = ref(false);

// --- Computed pour générer la chaîne "Année Scolaire" ---
const generatedSchoolYear = computed<string>(() => {
  if (!academicYearStart.value || !academicYearEnd.value) {
    return 'Année non définie';
  }
  try {
    const startDateObj = new Date(academicYearStart.value);
    const endDateObj = new Date(academicYearEnd.value);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return 'Dates année invalides';
    }

    const startYear = startDateObj.getFullYear();
    const endYear = endDateObj.getFullYear();
    return startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
  } catch (e) {
    console.error("Erreur de format de date pour generatedSchoolYear:", e);
    return "Erreur dates";
  }
});

const repartitionMessage = computed(() => {
  if (!academicYearStart.value || !academicYearEnd.value) {
    return 'Veuillez d\'abord définir les dates de l\'année scolaire.';
  }
  if (!periodType.value) {
    return 'Veuillez sélectionner un type de période (Trimestre ou Semestre).';
  }
  const maxPeriods = periodType.value === 'trimestre' ? 3 : 2;
  const currentPeriods = periodConfigurations.value.length;
  if (currentPeriods === 0) {
    return `Veuillez ajouter ${maxPeriods} ${periodType.value}s pour l'année scolaire.`;
  }
  if (currentPeriods < maxPeriods) {
    return `Il reste ${maxPeriods - currentPeriods} ${periodType.value}${maxPeriods - currentPeriods > 1 ? 's' : ''} à définir.`;
  }
  return `Tous les ${periodType.value}s sont définis.`;
});

const rules = computed<FormRules>(() => {
  const baseRules: FormRules = {
    academicYearStart: [{ required: true, message: 'Date de début d\'année requise', trigger: 'change' }],
    academicYearEnd: [
      { required: true, message: 'Date de fin d\'année requise', trigger: 'change' },
      {
        validator: (_rule, value, callback) => {
          if (value && academicYearStart.value && new Date(value) <= new Date(academicYearStart.value)) {
            callback(new Error('La date de fin doit être après la date de début'));
          } else {
            callback();
          }
        },
        trigger: 'change',
      },
    ],
    periodType: [{ required: true, message: 'Type de période requis', trigger: 'change' }],
  };

  periodConfigurations.value.forEach((_period, index) => {
    baseRules[`periodConfigurations[${index}].name`] = [
      { required: true, message: `Nom de la période ${index + 1} requis`, trigger: 'blur' },
    ];
    baseRules[`periodConfigurations[${index}].start`] = [
      { required: true, message: `Date de début période ${index + 1} requise`, trigger: 'change' },
      {
        validator: (_rule, value, callback) => { 
             if (!value) { callback(); return; }
             const valDate = new Date(value);
             const startYearDate = academicYearStart.value ? new Date(academicYearStart.value) : null;
             const endYearDate = academicYearEnd.value ? new Date(academicYearEnd.value) : null;

             if (startYearDate && valDate < startYearDate) {
                 callback(new Error('Doit être >= début année scolaire'));
             } else if (endYearDate && valDate > endYearDate) {
                  callback(new Error('Doit être <= fin année scolaire'));
             } else {
                 callback();
             }
         }, trigger: 'change',
      }
    ];
    baseRules[`periodConfigurations[${index}].end`] = [
      { required: true, message: `Date de fin période ${index + 1} requise`, trigger: 'change' },
      {
         validator: (_rule, value, callback) => { 
              if (!value) { callback(); return; }
              const valDate = new Date(value);
              const periodStartDateStr = periodConfigurations.value[index]?.start;
              const periodStartDate = periodStartDateStr ? new Date(periodStartDateStr) : null;
              const startYearDate = academicYearStart.value ? new Date(academicYearStart.value) : null;
              const endYearDate = academicYearEnd.value ? new Date(academicYearEnd.value) : null;

              if (periodStartDate && valDate <= periodStartDate) {
                  callback(new Error('Doit être > début de la période'));
              } else if (startYearDate && valDate < startYearDate) {
                 callback(new Error('Doit être >= début année scolaire'));
              } else if (endYearDate && valDate > endYearDate) {
                   callback(new Error('Doit être <= fin année scolaire'));
              } else {
                   callback();
              }
         }, trigger: 'change',
       }
    ];
  });
  return baseRules;
});

const handlePeriodTypeChange = () => {
  periodConfigurations.value = [];
  nextTick(() => {
    formRef.value?.clearValidate(); 
  });
};

const addPeriod = () => {
  const periodCount = periodConfigurations.value.length;
  const maxPeriods = periodType.value === 'trimestre' ? 3 : 2;
  
  if (periodCount >= maxPeriods) {
    ElMessage.warning(`Vous ne pouvez pas ajouter plus de ${maxPeriods} ${periodType.value}s`);
    return;
  }

  let startDateObj: Date | null = null;
  let endDateObj: Date | null = null;

  const ayStartVal = academicYearStart.value; 
  const ayEndVal = academicYearEnd.value;     

  if (periodCount === 0 && ayStartVal) {
    startDateObj = new Date(ayStartVal);
  } else if (periodCount > 0) {
    const lastPeriod = periodConfigurations.value[periodCount - 1];
    if (lastPeriod.end) { 
      startDateObj = new Date(lastPeriod.end);
      startDateObj.setDate(startDateObj.getDate() + 1);
    }
  }

  if (startDateObj && ayEndVal) {
    const ayEndDateObj = new Date(ayEndVal);
    if (startDateObj <= ayEndDateObj) { 
        const totalDays = Math.floor((ayEndDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
        const remainingPeriodsToDefine = maxPeriods - periodCount;
        
        if (remainingPeriodsToDefine > 0 && totalDays >=0) {
            const daysPerPeriod = Math.max(1, Math.floor(totalDays / remainingPeriodsToDefine)); 
            
            endDateObj = new Date(startDateObj);
            endDateObj.setDate(endDateObj.getDate() + daysPerPeriod -1);

            if (endDateObj > ayEndDateObj) {
                endDateObj = new Date(ayEndDateObj);
            }
        } else if (totalDays >=0) { 
           endDateObj = new Date(ayEndDateObj); 
        } else { 
            endDateObj = new Date(startDateObj);
        }
    } else {
      endDateObj = new Date(startDateObj); 
    }
  }
  
  if (startDateObj && periodCount + 1 === maxPeriods && ayEndVal) {
      const ayEndDateObj = new Date(ayEndVal);
      if (startDateObj <= ayEndDateObj) { 
        endDateObj = ayEndDateObj;
      } else if (endDateObj && endDateObj > ayEndDateObj) { 
        endDateObj = ayEndDateObj;
      }
  }


  periodConfigurations.value.push({
    id: nextPeriodId.value++,
    name: `${periodType.value.charAt(0).toUpperCase() + periodType.value.slice(1)} ${periodCount + 1}`,
    start: formatDateToString(startDateObj),
    end: formatDateToString(endDateObj),
    type: periodType.value
  });

  nextTick(() => {
    const scrollContainer = document.querySelector('.form-scroll-area .el-scrollbar__wrap');
    scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
    // Il est préférable de valider après que l'utilisateur ait interagi ou à la fin
    // formRef.value?.validate(); 
  });
};

const removePeriod = async (id: number) => {
  try {
    await ElMessageBox.confirm('Voulez-vous vraiment supprimer cette période ?', 'Confirmation', {
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
      type: 'warning'
    });
    periodConfigurations.value = periodConfigurations.value.filter(p => p.id !== id);
    ElMessage.success('Période supprimée.');
    nextTick(() => { 
        formRef.value?.clearValidate(); 
        // formRef.value?.validate(); // Revalider pour MAJ les messages globaux si besoin
    });
  } catch (error) {
      if (error !== 'cancel') console.error(error);
      else ElMessage.info('Suppression annulée.');
   }
};

const datePickerOptions = computed(() => ({
  disabledDate: (time: Date) => {
    if (!academicYearStart.value || !academicYearEnd.value) return false;
    const startYearDate = new Date(academicYearStart.value); 
    startYearDate.setHours(0, 0, 0, 0);
    const endYearDate = new Date(academicYearEnd.value);     
    endYearDate.setHours(23, 59, 59, 999);

    if (isNaN(startYearDate.getTime()) || isNaN(endYearDate.getTime())) return false;

    return time.getTime() < startYearDate.getTime() || time.getTime() > endYearDate.getTime();
  },
}));

const goBack = () => {
  emit('go-back');
};

const saveYearRepartition = async () => {
  try {
    isSaving.value = true;
    Loader.showLoader("Sauvegarde de la répartition annuelle en cours...");

    const finalPeriods = periodConfigurations.value.map(p => ({
      name: p.name,
      start: p.start ? new Date(p.start).toISOString() : null,
      end: p.end ? new Date(p.end).toISOString() : null,
      type: p.type
    }));

    const payload = {
      schoolYear: generatedSchoolYear.value,
      periodConfigurations: finalPeriods,
      isCurrent: true,
      periodType: periodType.value
    };

    // Sauvegarder la répartition
    const result = await window.ipcRenderer.invoke('yearRepartition:create', payload);

    if (result.success) {
      // Définir comme année en cours
      const setCurrentResult = await window.ipcRenderer.invoke(
        "yearRepartition:setCurrent", 
        result.data.id
      );

      if (setCurrentResult.success) {
        ElMessage.success('Répartition annuelle sauvegardée et définie comme année en cours');
        return true;
      } else {
        throw new Error(setCurrentResult.message || 'Erreur lors de la définition de l\'année en cours');
      }
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde de la répartition');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    return false;
  } finally {
    isSaving.value = false;
    setTimeout(() => {
      Loader.hideLoader();
    }, 500);
  }
};

const goNext = async () => {
  if (!formRef.value) return;
  
  const maxPeriods = periodType.value === 'trimestre' ? 3 : 2;
  if (periodConfigurations.value.length !== maxPeriods) {
    ElMessage.warning(`Veuillez configurer exactement ${maxPeriods} ${periodType.value}s.`);
    return;
  }

  try {
    const valid = await formRef.value.validate();
    if (valid) {
      const saved = await saveYearRepartition();
      if (saved) {
        const finalData = {
          schoolYear: generatedSchoolYear.value,
          periodConfigurations: periodConfigurations.value.map(p => ({
            name: p.name,
            start: p.start ? new Date(p.start).toISOString() : null,
            end: p.end ? new Date(p.end).toISOString() : null,
            type: p.type
          })),
          isCurrent: true,
          periodType: periodType.value
        };
        emit('configuration-saved', finalData);
      }
    } else {
      ElMessage.error('Veuillez corriger les erreurs.');
      await nextTick();
      const firstError = document.querySelector('.el-form-item.is-error');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
  } catch (error) {
    console.error('Erreur de validation:', error);
    ElMessage.error('Erreur lors de la validation du formulaire.');
  }
};

const revalidatePeriodFields = () => {
    if (formRef.value && periodConfigurations.value.length > 0) {
      nextTick(() => { // Attendre que les disabledDate soient potentiellement mis à jour
        periodConfigurations.value.forEach((_p, index) => {
            formRef.value?.validateField(`periodConfigurations[${index}].start`);
            formRef.value?.validateField(`periodConfigurations[${index}].end`);
        });
      });
    }
};
</script>

<template>
  <wizard-view-base>
    <template #title>
      Configurez la répartition de votre année scolaire.
    </template>

    <div class="repartition-info">
      <el-alert
        :title="repartitionMessage"
        type="info"
        :closable="false"
        show-icon
      />
    </div>

    <el-form
      ref="formRef"
      :model="{ academicYearStart, academicYearEnd, periodConfigurations, periodType }"
      :rules="rules"
      label-position="top"
      class="year-repartition-form"
    >
      <el-form-item label="Type de période" prop="periodType" required>
        <el-radio-group v-model="periodType" @change="handlePeriodTypeChange">
          <el-radio label="trimestre">Trimestre</el-radio>
          <el-radio label="semestre">Semestre</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="Année scolaire" prop="academicYearStart" required>
        <el-date-picker
          v-model="academicYearStart"
          type="date"
          placeholder="Date de début"
          class="full-width"
          :picker-options="datePickerOptions"
        >
          <template #prefix>
            <el-icon><Calendar /></el-icon>
          </template>
        </el-date-picker>
      </el-form-item>
      <el-form-item label="Année scolaire" prop="academicYearEnd" required>
        <el-date-picker
          v-model="academicYearEnd"
          type="date"
          placeholder="Date de fin"
          class="full-width"
          :picker-options="datePickerOptions"
        >
          <template #prefix>
            <el-icon><Calendar /></el-icon>
          </template>
        </el-date-picker>
      </el-form-item>

      <el-form-item label="Périodes" required>
        <div class="periods-container">
          <div v-for="(period) in periodConfigurations" :key="period.id" class="period-item">
            <el-input v-model="period.name" placeholder="Nom de la période" class="period-name" />
            <el-date-picker
              v-model="period.start"
              type="date"
              placeholder="Début"
              class="period-dates"
              :picker-options="datePickerOptions"
              @change="revalidatePeriodFields"
            >
              <template #prefix>
                <el-icon><Calendar /></el-icon>
              </template>
            </el-date-picker>
            <el-date-picker
              v-model="period.end"
              type="date"
              placeholder="Fin"
              class="period-dates"
              :picker-options="datePickerOptions"
              @change="revalidatePeriodFields"
            >
              <template #prefix>
                <el-icon><Calendar /></el-icon>
              </template>
            </el-date-picker>
            <el-button
              type="danger"
              circle
              @click="removePeriod(period.id)"
              :icon="Delete"
              class="remove-period"
            />
          </div>
          <el-button type="primary" @click="addPeriod" class="add-period">
            <el-icon><Plus /></el-icon>
            Ajouter une période
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        :loading="isSaving"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.year-repartition-container {
  padding: 15px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: calc(100vh - 160px); /* Hauteur du viewport moins header/footer wizard */
  max-height: 750px; /* Ou une autre valeur fixe si désiré, ou la retirer pour 100vh */
  overflow: hidden; 
}

.info-text {
  text-align: center;
  margin-bottom: 15px;
  display: block;
  width: 100%;
  flex-shrink: 0; /* Ne pas réduire cet élément */
}

.title-instruction {
  font-family: 'Arial', sans-serif;
  font-size: 1.1em;
  color: #606266;
}
.el-text--warning.title-instruction {
   color: #E6A23C;
}

.form-scroll-area {
  width: 100%;
  max-width: 950px;
  flex-grow: 1; /* Prend toute la hauteur disponible MOINS les autres éléments flex */
  min-height: 0; /* Crucial pour que flex-grow fonctionne correctement avec le scroll */
  margin-bottom: 0; /* La marge est gérée par le padding des boutons */
}

.year-repartition-form {
  width: 100%;
  padding: 5px 10px;
  box-sizing: border-box;
  height: calc(100vh - 200px); /* Hauteur fixe moins l'espace pour le titre et les boutons */
  overflow-y: auto; /* Permet le défilement vertical */
  margin-bottom: 20px; /* Espace avant les boutons */
}

.section-card {
    margin-bottom: 20px;
    border: none;
    background-color: #fcfcfc;
}
.section-card :deep(.el-card__header) {
    background-color: #f5f7fa;
    border-bottom: 1px solid #ebeef5;
    padding: 10px 15px;
    font-weight: bold;
}
.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #303133;
}

.full-width {
  width: 100%;
}

.date-warning {
    padding: 10px;
    text-align: center;
    background-color: #fef0f0; 
    border: 1px solid #fde2e2;
    border-radius: 4px;
    margin-bottom: 15px;
    color: #f56c6c;
}

.subdivision-block {
  border: 1px solid #e9e9eb;
  border-radius: 4px;
  padding: 15px 15px 5px 15px;
  margin-bottom: 15px;
  background-color: #fff;
  position: relative;
}
.subdivision-title {
    display: block;
    font-weight: bold;
    margin-bottom: 10px;
    color: var(--el-color-primary);
}

.delete-col {
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

.delete-button {
    margin-left: auto;
}

.add-button-container {
  text-align: center;
  margin-top: 15px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  align-items: center; /* Centre les boutons horizontalement en mode colonne */
  width: 100%;
  /* max-width appliqué dans media query pour desktop */
  gap: 15px;
  flex-shrink: 0; 
  padding: 15px 15px 10px 15px; /* Espace autour des boutons, 15px左右, 10px en bas */
  background-color: #fff; /* Pour cacher le contenu qui défile derrière si besoin */
  border-top: 1px solid #ebeef5; /* Séparateur visuel */
}

.action-button {
  width: 100%; /* Pleine largeur sur mobile */
  max-width: 280px; /* Limite la largeur des boutons sur mobile */
  padding: 10px 20px;
  font-size: 0.95rem;
}

/* --- Media Queries --- */
@media (min-width: 768px) { /* md et plus */
  .action-buttons {
    flex-direction: row-reverse;
    justify-content: center; /* Centre les boutons horizontalement en mode ligne */
    max-width: none; /* La largeur sera déterminée par les boutons eux-mêmes et le gap */
    padding: 15px 20px; /* Ajuster le padding pour desktop */
  }

  .action-button {
    width: auto; /* Largeur basée sur le contenu */
    min-width: 140px; /* Largeur minimale pour une bonne apparence */
    max-width: none; /* Retirer la limite mobile */
  }

  .delete-col {
    justify-content: center;
  }
}

@media (max-width: 576px) { /* xs screens */
    .delete-col {
         justify-content: flex-start;
         margin-top: 5px;
    }
     .delete-button {
        margin-left: 0;
    }
}

/* --- El-Scrollbar Internals --- */
:deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}

:deep(.el-form-item) {
    margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  font-weight: 500;
  padding-bottom: 2px;
  line-height: 1.3;
}

:deep(.el-date-editor.el-input),
:deep(.el-date-editor.el-input__inner) {
    width: 100% !important;
}

.repartition-info {
  width: 100%;
  margin-bottom: 20px;
}

.repartition-info .el-alert {
  margin-bottom: 0;
}

.periods-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.period-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  transition: all 0.3s ease;
}

.period-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.period-name {
  width: 200px;
}

.period-dates {
  flex: 1;
}

.remove-period {
  flex-shrink: 0;
}

.add-period {
  margin-top: 10px;
  width: 100%;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper),
:deep(.el-date-editor) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-date-editor:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}
</style>