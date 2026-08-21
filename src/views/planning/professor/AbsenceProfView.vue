<template>
  <div class="absence-view">
    <el-card class="absence-card">
      <template #header>
        <div class="card-header">
          <h2>Gestion des Absences Professeurs</h2>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="Sélectionner une date"
          :disabled-date="disableWeekends"
          @change="loadSchedules"
        />

        <el-select
          v-model="selectedClassFilter"
          placeholder="Filtrer par classe"
          clearable
          @change="handleFilter"
        >
          <el-option
            v-for="cls in classes"
            :key="cls.id"
            :label="cls.name"
            :value="cls.id"
          />
        </el-select>

        <el-select
          v-model="selectedProfessorFilter"
          placeholder="Filtrer par professeur"
          clearable
          filterable
          @change="handleFilter"
        >
          <el-option
            v-for="prof in professors"
            :key="prof.id"
            :label="`${prof.firstname} ${prof.lastname}`"
            :value="prof.id"
          />
        </el-select>
      </div>

      <!-- Tableau principal des absences -->
      <div class="timetable-section" v-if="selectedDate">
        <el-table 
          :data="filteredProfessorsSchedule" 
          border 
          style="width: 100%" 
          height="35vh"
          size="large"
          :row-style="{ height: '60px' }"
        >
          <el-table-column label="Professeur" fixed="left" min-width="250">
            <template #default="{ row }">
              <div class="professor-info">
                <el-avatar :size="40">
                  {{ getInitials(row.professor) }}
                </el-avatar>
                <div class="professor-details">
                  <span class="professor-name">{{ row.professor.firstname }} {{ row.professor.lastname }}</span>
                  <small class="professor-teaching">{{ getTeachingInfo(row.professor) }}</small>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-for="timeSlot in timeSlots"
            :key="timeSlot"
            :label="formatTimeSlot(timeSlot)"
            align="center"
            width="140"
          >
            <template #default="{ row }">
              <div class="schedule-cell">
                <div class="schedule-info">
                  <div class="class-name">{{ getClassInfo(row.professor, timeSlot) || getTeachingClassName(row.professor) }}</div>
                  <el-checkbox
                    v-model="row.absences[timeSlot].checked"
                    @change="(val: boolean) => handleAbsenceChange(row.professor, timeSlot, val)"
                    size="large"
                  >
                    <span class="checkbox-label">Absent</span>
                  </el-checkbox>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- Boutons d'action -->
        <div class="actions-bar">
          <el-button @click="resetAll" size="large">
            <Icon icon="mdi:refresh" class="mr-2" />
            Réinitialiser
          </el-button>
          <el-button type="primary" @click="saveAbsences" :loading="saving" size="large">
            <Icon icon="mdi:content-save" class="mr-2" />
            Enregistrer les absences ({{ getSelectedAbsencesCount() }})
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Dialog pour motif d'absence -->
    <el-dialog
      v-model="reasonDialogVisible"
      title="Motif de l'absence"
      width="500px"
    >
      <el-form :model="reasonForm" label-width="120px">
        <el-form-item label="Justifiée">
          <el-switch v-model="reasonForm.justified" />
        </el-form-item>

        <el-form-item label="Type" v-if="reasonForm.justified">
          <el-select v-model="reasonForm.reasonType" placeholder="Sélectionner un type">
            <el-option label="Médical" value="MEDICAL">
              <Icon icon="mdi:medical-bag" class="mr-2" />
              Médical
            </el-option>
            <el-option label="Familial" value="FAMILY">
              <Icon icon="mdi:account-group" class="mr-2" />
              Familial
            </el-option>
            <el-option label="Activité scolaire" value="SCHOOL_ACTIVITY">
              <Icon icon="mdi:school" class="mr-2" />
              Activité scolaire
            </el-option>
            <el-option label="Autre" value="OTHER">
              <Icon icon="mdi:dots-horizontal" class="mr-2" />
              Autre
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="Motif">
          <el-input
            v-model="reasonForm.reason"
            type="textarea"
            :rows="3"
            placeholder="Préciser le motif de l'absence..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="cancelReason">
          <Icon icon="mdi:close" class="mr-1" />
          Annuler
        </el-button>
        <el-button type="primary" @click="confirmReason">
          <Icon icon="mdi:check" class="mr-1" />
          Confirmer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { generateSlots, formatTimeSlotForDisplay, normSlot } from '@/composables/useScheduleSlots';
import type { ITeachingAssignment } from '@/types/shared';

type TeachingWithLegacy = ITeachingAssignment & { selectedClasses?: number[]; selectedCourse?: number; grades?: { id: number; name: string }[]; gradeNames?: string; gradeIds?: string | number[] };

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
  teaching?: TeachingWithLegacy[];
}

type ReasonType = 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';

interface ReasonForm {
  justified: boolean;
  reasonType: ReasonType | null;
  reason: string;
}

interface AbsenceInfo {
  checked: boolean;
  reason: string;
  justified: boolean;
  reasonType: ReasonType;
}

interface ProfessorSchedule {
  professor: Professor;
  absences: Record<string, AbsenceInfo>;
  schedules: any[];
}

// États
const loading = ref(false);
const saving = ref(false);
const reasonDialogVisible = ref(false);
const professors = ref<Professor[]>([]);
const classes = ref<any[]>([]);
const selectedDate = ref<Date | null>(null);
const professorsSchedule = ref<ProfessorSchedule[]>([]);
const selectedClassFilter = ref<number | null>(null);
const selectedProfessorFilter = ref<number | null>(null);

// Variables pour le dialog de motif
const pendingAbsence = ref<{professor: any, timeSlot: string, checked: boolean} | null>(null);
const reasonForm = ref<ReasonForm>({
  justified: false,
  reasonType: null,
  reason: ''
});

// Créneaux horaires - canonical keys "HH:mm-HH:mm"
const timeSlots = ref<string[]>([])

const defaultTimeSlots: string[] = generateSlots({
  startHour: 8,
  startMinutes: 0,
  endHour: 18,
  endMinutes: 0,
  slotDuration: 60,
  lunchStart: 12,
  lunchStartMinutes: 0,
  lunchEnd: 14,
  lunchEndMinutes: 0
}).map(s => s.key)

const loadScheduleConfig = async () => {
  try {
    const result = await window.ipcRenderer.invoke('schedule-config:get', { classId: null })
    if (result.success && result.data) {
      const cfg = result.data
      const config = {
        startHour: cfg.startHour ?? 8,
        startMinutes: cfg.startMinutes ?? 0,
        endHour: cfg.endHour ?? 18,
        endMinutes: cfg.endMinutes ?? 0,
        slotDuration: cfg.slotDuration ?? 60,
        lunchStart: cfg.lunchStart ?? 12,
        lunchStartMinutes: cfg.lunchStartMinutes ?? 0,
        lunchEnd: cfg.lunchEnd ?? 14,
        lunchEndMinutes: cfg.lunchEndMinutes ?? 0
      }
      const slots = generateSlots(config).map(s => s.key)
      timeSlots.value = slots.length > 0 ? slots : defaultTimeSlots
    } else {
      timeSlots.value = defaultTimeSlots
    }
  } catch (error) {
    console.error('Error loading schedule config:', error)
    timeSlots.value = defaultTimeSlots
  }
}

// Helpers for filtering with teaching fallback
const matchTeaching = (prof: Professor, filterId: number): boolean => {
  if (!prof.teaching || !Array.isArray(prof.teaching)) return false
  return prof.teaching.some((t: TeachingWithLegacy) => {
    if (t.class?.id === filterId) return true
    if (t.grades?.some((g: { id: number; name: string }) => g.id === filterId)) return true
    if (t.gradeIds) {
      const raw = t.gradeIds as string | number[];
      const ids = Array.isArray(raw)
        ? raw.map((n: number) => Number(n)).filter((n: number) => !Number.isNaN(n))
        : String(raw).split(',').map((s: string) => Number(s.trim())).filter((n: number) => !Number.isNaN(n))
      if (ids.includes(filterId)) return true
    }
    return false
  })
}

// Computed
const filteredProfessorsSchedule = computed(() => {
  let filtered = [...professorsSchedule.value];

  // Filtre par classe with fallback to teaching
  if (selectedClassFilter.value) {
    filtered = filtered.filter(profSchedule =>
      profSchedule.schedules?.some((schedule: any) => schedule.classId === selectedClassFilter.value)
      || matchTeaching(profSchedule.professor, selectedClassFilter.value as number)
    );
  }

  // Filtre par professeur
  if (selectedProfessorFilter.value) {
    filtered = filtered.filter(profSchedule =>
      profSchedule.professor.id === selectedProfessorFilter.value
    );
  }

  return filtered;
});

// Méthodes
const formatTimeSlot = (slot: string) => {
  return formatTimeSlotForDisplay(slot)
};

const getTeachingClassName = (professor: Professor): string => {
  if (!professor?.teaching || !Array.isArray(professor.teaching) || professor.teaching.length === 0) return ''
  const first = professor.teaching[0] as TeachingWithLegacy
  if (first.class?.name) return first.class.name
  if (first.grades && Array.isArray(first.grades) && first.grades.length > 0) return first.grades[0].name
  if (first.gradeNames) return String(first.gradeNames).split(',')[0].trim()
  return ''
};

const getInitials = (professor: Professor): string => {
  return `${professor.firstname[0]}${professor.lastname[0]}`.toUpperCase();
};

const getTeachingInfo = (professor: Professor): string => {
  if (!professor?.teaching || !Array.isArray(professor.teaching) || professor.teaching.length === 0) {
    return 'Aucune affectation';
  }
  
  return professor.teaching.map(t => {
    const courseInfo = t.course?.name ? `${t.course.name}` : '';
    const classInfo = t.class?.name ? `${t.class.name}` : '';
    
    let gradesInfo = '';
    if (t.grades && Array.isArray(t.grades) && t.grades.length > 0) {
      const uniqueGradeNames = [...new Set(t.grades.map(g => g.name))];
      gradesInfo = uniqueGradeNames.join(', ');
    }
    
    let gradeNamesInfo = '';
    if (t.gradeNames) {
      const names = t.gradeNames.split(', ');
      const uniqueNames = [...new Set(names)];
      gradeNamesInfo = uniqueNames.join(', ');
    }
    
    let finalClassInfo = classInfo;
    const gradesOrNames = gradesInfo || gradeNamesInfo;
    
    if (finalClassInfo && gradesOrNames) {
      if (gradesOrNames.includes(finalClassInfo)) {
        finalClassInfo = '';
      }
    }
    
    const parts = [courseInfo, finalClassInfo, gradesOrNames].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Affectation sans détails';
  }).filter(Boolean).join(', ') || 'Affectation sans détails';
};

const loadClasses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    console.log("données classe", result )
    if (result.success) {
      classes.value = result.data;
      if (classes.value.length > 0) {
        // Ne pas sélectionner automatiquement la première classe
        // selectedClassFilter.value = classes.value[0].id;
      }
    } else {
      throw new Error(result.message || 'Erreur lors du chargement des classes');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error("Erreur lors du chargement des classes");
  }
};

const loadProfessors = async () => {
  try {
    const result = await window.ipcRenderer.invoke('professor:all');
    if (result.success) {
      professors.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des professeurs');
  }
};

const disableWeekends = (_date: Date) => {
  return false;
};

const loadSchedules = async () => {
  if (!selectedDate.value || professors.value.length === 0) {
    return;
  }

  try {
    loading.value = true;
    const dateStr = selectedDate.value.toISOString().split('T')[0];
    console.log('[loadSchedules] Date sélectionnée:', dateStr);

    const [scheduleResult, absenceResult] = await Promise.all([
      window.ipcRenderer.invoke('schedule:getByDate', { date: dateStr }),
      window.ipcRenderer.invoke('absence:allProfessor')
    ]);
    console.log("shedule value :",scheduleResult )
    console.log("absences value :", absenceResult?.data?.length)

    // Build map of existing absences for this date: key = professorId + normalized slot
    const absenceMap = new Map<string, any>()
    if (absenceResult?.success && Array.isArray(absenceResult.data)) {
      absenceResult.data.forEach((abs: any) => {
        const absDate = abs.date ? new Date(abs.date).toISOString().split('T')[0] : null
        if (absDate !== dateStr) return
        const profId = abs.professor?.id ?? abs.professorId
        if (!profId) return
        // Reconstruct slot key from startTime/endTime (stored as HH:mm:ss)
        let absSlot: string | null = null
        if (abs.startTime && abs.endTime) {
          const s = abs.startTime.substring(0,5) // "08:30"
          const e = abs.endTime.substring(0,5) // "09:30"
          absSlot = `${s}-${e}` // "08:30-09:30"
        } else if ((abs as any).timeSlot) {
          absSlot = (abs as any).timeSlot
        }
        if (!absSlot) return
        // Normalize to match timeSlots keys
        const canonical = timeSlots.value.find(ts => normSlot(ts) === normSlot(absSlot!))
        const keySlot = canonical || absSlot
        const mapKey = `${profId}__${normSlot(keySlot)}`
        absenceMap.set(mapKey, abs)
      })
    }

    if (scheduleResult.success) {
      professorsSchedule.value = professors.value.map(prof => {
        const absences: Record<string, AbsenceInfo> = {}
        timeSlots.value.forEach(slot => {
          const mapKey = `${prof.id}__${normSlot(slot)}`
          const existing = absenceMap.get(mapKey)
          if (existing) {
            absences[slot] = {
              checked: true,
              reason: existing.reason || '',
              justified: !!existing.justified,
              reasonType: existing.reasonType || 'UNAUTHORIZED'
            }
          } else {
            absences[slot] = {
              checked: false,
              reason: '',
              justified: false,
              reasonType: 'UNAUTHORIZED'
            }
          }
        })
        return {
          professor: prof,
          absences,
          schedules: scheduleResult.data.filter((s: { professorId: number }) => s.professorId === prof.id)
        }
      });
    }
  } catch (error) {
    console.error('[loadSchedules] Exception:', error);
    ElMessage.error("Erreur lors du chargement des emplois du temps");
  } finally {
    loading.value = false;
  }
};

// keep hasSchedule for hint / external use (avoids TS6133)
const hasSchedule = (professor: any, timeSlot: string) => {
  const profSchedule = professorsSchedule.value.find(p => p.professor.id === professor.id);
  return profSchedule?.schedules.some((s: any) => normSlot(String(s.timeSlot)) === normSlot(timeSlot)) || false;
};
void hasSchedule;

const getClassInfo = (professor: any, timeSlot: string) => {
  const profSchedule = professorsSchedule.value.find(p => p.professor.id === professor.id);
  const schedule = profSchedule?.schedules.find((s: any) => normSlot(String(s.timeSlot)) === normSlot(timeSlot));
  if (schedule && schedule.classId) {
    const foundClass = classes.value.find(cls => cls.id === schedule.classId);
    return foundClass ? foundClass.name : '';
  }
  return '';
};

const handleAbsenceChange = (professor: any, timeSlot: string, checked: boolean) => {
  if (checked) {
    // Ouvrir le dialog pour saisir le motif
    pendingAbsence.value = { professor, timeSlot, checked };
    reasonForm.value = {
      justified: false,
      reasonType: null,
      reason: ''
    };
    reasonDialogVisible.value = true;
  } else {
    // Si on décoche, on réinitialise directement
    const profSchedule = professorsSchedule.value.find(p => p.professor.id === professor.id);
    if (profSchedule) {
      profSchedule.absences[timeSlot] = {
        checked: false,
        reason: '',
        justified: false,
        reasonType: 'UNAUTHORIZED'
      };
    }
  }
};

const confirmReason = () => {
  if (!pendingAbsence.value) return;

  const { professor, timeSlot } = pendingAbsence.value;
  const profSchedule = professorsSchedule.value.find(p => p.professor.id === professor.id);
  
  if (profSchedule) {
    profSchedule.absences[timeSlot] = {
      checked: true,
      reason: reasonForm.value.reason || 'Non précisé',
      justified: reasonForm.value.justified,
      reasonType: reasonForm.value.justified && reasonForm.value.reasonType 
        ? reasonForm.value.reasonType 
        : 'UNAUTHORIZED'
    };
  }

  reasonDialogVisible.value = false;
  pendingAbsence.value = null;
};

const cancelReason = () => {
  if (pendingAbsence.value) {
    const { professor, timeSlot } = pendingAbsence.value;
    const profSchedule = professorsSchedule.value.find(p => p.professor.id === professor.id);
    
    if (profSchedule) {
      profSchedule.absences[timeSlot].checked = false;
    }
  }

  reasonDialogVisible.value = false;
  pendingAbsence.value = null;
};

const getSelectedAbsencesCount = () => {
  return professorsSchedule.value.reduce((count, profSchedule) => {
    return count + Object.values(profSchedule.absences).filter((absence: AbsenceInfo) => absence.checked).length;
  }, 0);
};

const resetAll = () => {
  professorsSchedule.value.forEach(profSchedule => {
    timeSlots.value.forEach(slot => {
      profSchedule.absences[slot] = {
        checked: false,
        reason: '',
        justified: false,
        reasonType: 'UNAUTHORIZED'
      };
    });
  });
};

const saveAbsences = async () => {
  try {
    saving.value = true;
    const absencesToSave: any[] = [];

    for (const profSchedule of professorsSchedule.value) {
      for (const [timeSlot, absenceInfo] of Object.entries(profSchedule.absences) as [string, AbsenceInfo][]) {
        if (absenceInfo.checked) {
          const schedule = profSchedule.schedules.find((s: any) => normSlot(String(s.timeSlot)) === normSlot(timeSlot));
          const gradeId = schedule?.classId ?? (selectedClassFilter.value as number | null) ?? null;

          absencesToSave.push({
            professorId: profSchedule.professor.id,
            date: selectedDate.value?.toISOString().split('T')[0],
            timeSlot,
            reason: absenceInfo.reason || 'Non précisé',
            reasonType: absenceInfo.reasonType || 'UNAUTHORIZED',
            justified: absenceInfo.justified || false,
            absenceType: 'COURSE',
            gradeId: gradeId
          });
        }
      }
    }

    if (absencesToSave.length === 0) {
      ElMessage.warning('Aucune absence sélectionnée');
      return;
    }

    const result = await window.ipcRenderer.invoke('absence:createBatch', absencesToSave);
    
    if (result.success) {
      ElMessage.success(`${absencesToSave.length} absence(s) enregistrée(s) avec succès`);
      // Recharger pour afficher les cases cochées persistées
      await loadSchedules();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement:', error);
    ElMessage.error("Erreur lors de l'enregistrement des absences");
  } finally {
    saving.value = false;
  }
};

const handleFilter = () => {
  // Les filtres sont gérés par le computed filteredProfessorsSchedule
};

// Initialisation
onMounted(async () => {
  await loadClasses();
  await loadProfessors();
  await loadScheduleConfig();
  selectedDate.value = new Date();
  await loadSchedules();
});

watch(selectedDate, (newDate) => {
  if (newDate) {
    loadSchedules();
  }
});
</script>

<style scoped>
.absence-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: center;
}

.professor-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.professor-details {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.professor-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.professor-teaching {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 2px;
}

.timetable-section {
  margin-top: 20px;
}

.schedule-cell {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

.schedule-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.class-name {
  font-weight: 600;
  color: var(--el-color-primary);
  font-size: 13px;
  text-align: center;
  line-height: 1.2;
}

.checkbox-label {
  font-size: 12px;
  margin-left: 4px;
}

.no-schedule {
  color: var(--el-text-color-disabled);
  font-style: italic;
}

.actions-bar {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.mr-1 {
  margin-right: 4px;
}

.mr-2 {
  margin-right: 8px;
}

:deep(.el-checkbox) {
  height: auto;
}

:deep(.el-checkbox__label) {
  font-size: 12px;
}

:deep(.el-table .cell) {
  padding: 8px;
}

:deep(.el-select) {
  min-width: 200px;
}
</style>