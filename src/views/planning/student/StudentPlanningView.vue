<template>
  <div class="student-schedule">
    <el-card shadow="never" class="header-card">
      <div class="header-content">
        <div class="title-section">
          <el-icon :size="32" color="#409EFF"><Calendar /></el-icon>
          <h1>Emploi du Temps - Élèves</h1>
        </div>
        <div class="filters">
          <el-form :model="filters" inline>
            <el-form-item label="Classe :">
              <el-select v-model="filters.selectedClassId" placeholder="Sélectionner une classe" @change="onClassChange" style="width: 200px">
                <el-option v-for="cls in classes" :key="cls.id" :label="cls.name" :value="cls.id" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="selectedClass">
              <el-tag :type="selectedClass.type === 'PRIMARY' ? 'success' : 'primary'">
                {{ selectedClass.type === 'PRIMARY' ? 'Primaire' : 'Secondaire' }}
              </el-tag>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </el-card>

    <el-scrollbar height="65vh">
      <div class="main-content" v-loading="loading">
        <div class="schedule-grid-wrapper">
          <!-- Day toggle -->
          <div class="day-toggle">
            <el-checkbox v-for="day in days" :key="day.key" v-model="day.enabled" :label="day.label" size="small" border />
          </div>

          <!-- Schedule Grid -->
          <div class="schedule-grid" v-if="selectedClass">
            <div class="grid-header">
              <div class="time-column-header">Horaires</div>
              <div class="day-column-header" v-for="day in activeDays" :key="day.key">{{ day.label }}</div>
            </div>
            <div class="grid-body">
              <div class="grid-row" v-for="slot in timeSlots" :key="slot.key">
                <div class="time-cell">{{ slot.label }}</div>
                <div class="day-cell" v-for="day in activeDays" :key="day.key"
                  :class="{ occupied: getScheduleItem(day.key, slot.key) }"
                  :style="getCellStyle(day.key, slot.key)">
                  <template v-if="getScheduleItem(day.key, slot.key)">
                    <div class="schedule-item-content">
                      <span class="course-name">{{ getScheduleItem(day.key, slot.key)?.course?.name || 'Enseignement' }}</span>
                      <span class="prof-name">{{ getScheduleItem(day.key, slot.key)?.professor?.firstname }} {{ getScheduleItem(day.key, slot.key)?.professor?.lastname }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-class-selected">
            <el-icon :size="48" color="#DCDFE6"><Calendar /></el-icon>
            <p>Sélectionnez une classe pour voir son emploi du temps</p>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Calendar } from '@element-plus/icons-vue'
import { generateSlots, normSlot } from '@/composables/useScheduleSlots'

interface DayItem {
  key: string
  label: string
  enabled: boolean
}

interface TimeSlot {
  key: string
  label: string
}

const classes = ref<any[]>([])
const schedules = ref<any[]>([])
const loading = ref(false)

const filters = reactive({
  selectedClassId: null as number | null
})

const days = ref<DayItem[]>([
  { key: 'lundi', label: 'Lundi', enabled: true },
  { key: 'mardi', label: 'Mardi', enabled: true },
  { key: 'mercredi', label: 'Mercredi', enabled: true },
  { key: 'jeudi', label: 'Jeudi', enabled: true },
  { key: 'vendredi', label: 'Vendredi', enabled: true },
  { key: 'samedi', label: 'Samedi', enabled: true },
  { key: 'dimanche', label: 'Dimanche', enabled: true }
])

const timeSlots = ref<TimeSlot[]>([])

const activeDays = computed(() => days.value.filter(d => d.enabled))

const selectedClass = computed(() => classes.value.find((c: any) => c.id === filters.selectedClassId))

const courseColors: Record<number | string, string> = {}
let colorIndex = 0
const palette = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#B37FEB', '#36CFC9', '#F2A7B3', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#14B8A6']
const professorDistinctColors: Record<number, string> = {}

function getProfessorDistinctColor(prof: any): string | null {
  if (!prof?.id) return null
  if (professorDistinctColors[prof.id]) return professorDistinctColors[prof.id]
  // Si couleur personnalisée non-default et unique, l'utiliser
  if (prof.color && prof.color !== '#409EFF') {
    professorDistinctColors[prof.id] = prof.color
    return prof.color
  }
  // Sinon palette distincte par id
  const color = palette[prof.id % palette.length]
  professorDistinctColors[prof.id] = color
  return color
}

function getColorForCourse(courseId: number | string): string {
  const key = courseId as number | string
  if (!courseColors[key]) {
    courseColors[key] = palette[colorIndex % palette.length]
    colorIndex++
  }
  return courseColors[key]
}

function getScheduleItem(dayKey: string, slotKey: string): any {
  return schedules.value.find((s: any) => s.day === dayKey && normSlot(String(s.timeSlot)) === normSlot(String(slotKey)))
}

function getCellStyle(dayKey: string, slotKey: string) {
  const item = getScheduleItem(dayKey, slotKey)
  if (!item) return {}
  // Priority: couleur distincte par professeur (même si même default en DB)
  const profDistinct = item.professor ? getProfessorDistinctColor(item.professor) : null
  if (profDistinct) {
    return {
      backgroundColor: profDistinct + '15',
      borderLeft: `3px solid ${profDistinct}`,
      cursor: 'default'
    }
  }
  const profColor: string | null = item.professor?.color || null
  if (profColor) {
    return {
      backgroundColor: profColor + '15',
      borderLeft: `3px solid ${profColor}`,
      cursor: 'default'
    }
  }
  // Fallback: handle PRIMARY where course may be null but professorId exists
  // If schedule item lacks professor embed but has professorId, color would already be undefined – fallback to palette
  // Resolve course identifier (supports both numeric courseId and string primary-<id>)
  const courseId = item.course?.id ?? item.courseId
  if (courseId != null) {
    // For SECONDARY: numeric courseId -> palette (which may be seeded from professor color elsewhere)
    // For PRIMARY with string id, getColorForCourse will assign deterministic palette if no profColor
    const color = getColorForCourse(courseId as number | string)
    return {
      backgroundColor: color + '15',
      borderLeft: `3px solid ${color}`,
      cursor: 'default'
    }
  }
  // Ultimate fallback: neutral primary color
  const fallback = '#409EFF'
  return {
    backgroundColor: fallback + '15',
    borderLeft: `3px solid ${fallback}`,
    cursor: 'default'
  }
}

const loadClasses = async () => {
  const result = await window.ipcRenderer.invoke('grade:all')
  if (result.success) classes.value = result.data || []
}

const defaultStudentSlots: TimeSlot[] = generateSlots({
  startHour: 8,
  startMinutes: 0,
  endHour: 18,
  endMinutes: 0,
  slotDuration: 60,
  lunchStart: 12,
  lunchStartMinutes: 0,
  lunchEnd: 14,
  lunchEndMinutes: 0
})

const loadScheduleConfig = async () => {
  const result = await window.ipcRenderer.invoke('schedule-config:get', { classId: filters.selectedClassId })
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
    const slots = generateSlots(config)
    timeSlots.value = slots.length > 0 ? slots : defaultStudentSlots
  } else {
    timeSlots.value = defaultStudentSlots
  }
}

const loadSchedules = async () => {
  if (!filters.selectedClassId) { schedules.value = []; return }
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('schedule:by-class', filters.selectedClassId)
    if (result.success) schedules.value = result.data || []
    else schedules.value = []
  } catch (error) {
    console.error('Error loading schedules:', error)
    schedules.value = []
  } finally {
    loading.value = false
  }
}

const onClassChange = async () => {
  await Promise.all([loadScheduleConfig(), loadSchedules()])
}

onMounted(() => {
  loadClasses()
})
</script>

<style scoped>
.student-schedule {
  padding: 24px;
}
.header-card {
  margin-bottom: 20px;
  border-radius: 12px;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}
.title-section h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
}
.main-content {
  padding: 0 4px;
}
.day-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.schedule-grid {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}
.grid-header {
  display: flex;
  background: #f5f7fa;
  font-weight: 600;
  font-size: 13px;
}
.time-column-header {
  width: 100px;
  min-width: 100px;
  padding: 12px 16px;
  border-right: 1px solid #ebeef5;
}
.day-column-header {
  flex: 1;
  padding: 12px 16px;
  text-align: center;
  border-right: 1px solid #ebeef5;
}
.day-column-header:last-child {
  border-right: none;
}
.grid-row {
  display: flex;
  border-top: 1px solid #ebeef5;
}
.time-cell {
  width: 100px;
  min-width: 100px;
  padding: 12px 16px;
  font-size: 12px;
  color: #909399;
  border-right: 1px solid #ebeef5;
  display: flex;
  align-items: center;
}
.day-cell {
  flex: 1;
  padding: 8px;
  border-right: 1px solid #ebeef5;
  min-height: 60px;
  transition: background-color 0.2s;
}
.day-cell:last-child {
  border-right: none;
}
.day-cell.occupied {
  border-radius: 4px;
}
.schedule-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.course-name {
  font-size: 12px;
  font-weight: 600;
  color: #2c3e50;
}
.prof-name {
  font-size: 11px;
  color: #909399;
}
.no-class-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #909399;
  gap: 16px;
}
.no-class-selected p {
  font-size: 16px;
}
</style>
