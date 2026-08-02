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

const courseColors: Record<number, string> = {}
let colorIndex = 0
const palette = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#B37FEB', '#36CFC9', '#F2A7B3']

function getColorForCourse(courseId: number): string {
  if (!courseColors[courseId]) {
    courseColors[courseId] = palette[colorIndex % palette.length]
    colorIndex++
  }
  return courseColors[courseId]
}

function getScheduleItem(dayKey: string, slotKey: string): any {
  return schedules.value.find((s: any) => s.day === dayKey && s.timeSlot === slotKey)
}

function getCellStyle(dayKey: string, slotKey: string) {
  const item = getScheduleItem(dayKey, slotKey)
  if (!item) return {}
  const color = item.course?.id ? getColorForCourse(item.course.id) : '#409EFF'
  return {
    backgroundColor: color + '15',
    borderLeft: `3px solid ${color}`,
    cursor: 'default'
  }
}

const loadClasses = async () => {
  const result = await window.ipcRenderer.invoke('grade:all')
  if (result.success) classes.value = result.data || []
}

const loadScheduleConfig = async () => {
  const result = await window.ipcRenderer.invoke('schedule-config:get', { classId: filters.selectedClassId })
  if (result.success && result.data) {
    const config = result.data
    const slots: TimeSlot[] = []
    let h = config.startHour
    while (h < config.endHour) {
      if (h >= config.lunchStart && h < config.lunchEnd) {
        h = config.lunchEnd
        continue
      }
      const endH = h + config.slotDuration / 60
      if (endH > config.endHour) break
      slots.push({ key: `${h}-${endH}`, label: `${h}h - ${endH}h` })
      h = endH
    }
    timeSlots.value = slots
  } else {
    timeSlots.value = [
      { key: '8-9', label: '8h-9h' },
      { key: '9-10', label: '9h-10h' },
      { key: '10-11', label: '10h-11h' },
      { key: '11-12', label: '11h-12h' },
      { key: '14-15', label: '14h-15h' },
      { key: '15-16', label: '15h-16h' },
      { key: '16-17', label: '16h-17h' },
      { key: '17-18', label: '17h-18h' }
    ]
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
