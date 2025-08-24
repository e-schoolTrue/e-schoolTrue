<template>
  <div class="schedule-manager">
    <!-- Header -->
    <el-card class="header-card" shadow="never">
      <div class="header-content">
        <div class="title-section">
          <el-icon :size="32" color="#409EFF"><Calendar /></el-icon>
          <h1>Gestionnaire d'Emploi du Temps</h1>
        </div>
        
        <!-- Filtres -->
        <div class="filters">
          <el-form :model="filters" inline>
            <el-form-item label="Classe :">
              <el-select 
                v-model="filters.selectedClassId" 
                placeholder="Sélectionner une classe"
                @change="onClassChange"
                style="width: 200px"
              >
                <el-option
                  v-for="cls in classes"
                  :key="cls.id"
                  :label="cls.name"
                  :value="cls.id"
                />
              </el-select>
            </el-form-item>
            
            <el-form-item v-if="selectedClass">
              <el-tag :type="selectedClass.type === 'PRIMARY' ? 'success' : 'primary'">
                {{ selectedClass.type === 'PRIMARY' ? 'École Primaire' : 'École Secondaire' }}
              </el-tag>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </el-card>

    <div class="main-content" v-loading="loading">
      <!-- Sidebar - Professeurs/Matières -->
      <div class="sidebar">
        <el-card class="teachers-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><User /></el-icon>
              <span>
                {{ selectedClass?.type === 'PRIMARY' ? 'Professeurs Disponibles' : 'Professeurs & Matières' }}
              </span>
              <el-tag 
                v-if="selectedClass"
                :type="selectedClass.type === 'PRIMARY' ? 'success' : 'primary'" 
                size="small"
              >
                {{ selectedClass.type === 'PRIMARY' ? 'Primaire' : 'Secondaire' }}
              </el-tag>
            </div>
          </template>
          
          <div class="teachers-list">
            <div
              v-for="item in availableTeachingItems"
              :key="`${item.professor.id}-${item.course.id}`"
              :class="[
                'teacher-item',
                selectedClass?.type === 'PRIMARY' ? 'primary-item' : 'secondary-item'
              ]"
              :draggable="true"
              @dragstart="handleDragStart($event, item)"
              :style="{ borderLeftColor: getCourseColor(item.course.id) }"
            >
              <div class="course-info">
                <!-- Affichage pour le primaire -->
                <template v-if="selectedClass?.type === 'PRIMARY'">
                  <div class="professor-name-primary">
                    {{ item.professor.civility }} {{ item.professor.firstname }} {{ item.professor.lastname }}
                  </div>
                  <div class="course-name-primary">{{ item.course.name }}</div>
                  <div v-if="item.professor.qualification" class="qualification">
                    {{ item.professor.qualification.name }}
                  </div>
                </template>
                
                <!-- Affichage pour le secondaire -->
                <template v-else>
                  <div class="course-name">{{ item.course.name }}</div>
                  <div class="professor-name">
                    {{ item.professor.civility }} {{ item.professor.firstname }} {{ item.professor.lastname }}
                  </div>
                  <div v-if="item.professor.qualification" class="qualification">
                    {{ item.professor.qualification.name }}
                  </div>
                </template>
                
                <div v-if="getCourseDuration(item.course.id)" class="duration-info">
                  <el-icon><Clock /></el-icon>
                  {{ getCourseDuration(item.course.id) }}h
                </div>
              </div>
              
              <el-avatar 
                v-if="item.professor.photo"
                :size="selectedClass?.type === 'PRIMARY' ? 35 : 30"
                :src="getPhotoUrl(item.professor.photo)"
                :alt="item.professor.firstname"
              />
            </div>
            
            <!-- Message si aucun professeur -->
            <div v-if="availableTeachingItems.length === 0" class="no-teachers">
              <el-empty 
                :image-size="80"
                :description="`Aucun professeur assigné à cette classe ${selectedClass?.type === 'PRIMARY' ? 'primaire' : 'secondaire'}`"
              />
            </div>
          </div>
        </el-card>
      </div>

      <!-- Tableau principal -->
      <div class="schedule-section">
        <el-card class="schedule-card" shadow="never">
          <!-- Conteneur avec scroll horizontal -->
          <div class="schedule-container">
            <!-- Header des jours -->
            <div class="schedule-header">
              <div class="time-header">Horaires</div>
              <div
                v-for="(day, index) in days"
                :key="day.key"
                :class="['day-header', { 'disabled': !day.enabled, 'enabled': day.enabled }]"
                @click="toggleDay(index)"
              >
                {{ day.label }}
                <div v-if="!day.enabled" class="enable-hint">Cliquer pour activer</div>
              </div>
            </div>

            <!-- Grille horaire -->
            <div class="schedule-grid">
              <div
                v-for="timeSlot in timeSlots"
                :key="timeSlot.key"
                class="schedule-row"
              >
                <div class="time-slot">
                  <el-icon><Clock /></el-icon>
                  {{ timeSlot.label }}
                </div>
                
                <div
                  v-for="(day, _dayIndex) in days"
                  :key="`${day.key}-${timeSlot.key}`"
                  :class="[
                    'schedule-cell',
                    {
                      'disabled': !day.enabled,
                      'drag-over': dragOverCell === `${day.key}-${timeSlot.key}`,
                      'has-conflict': hasConflict(day.key, timeSlot.key)
                    }
                  ]"
                  @dragenter="handleDragEnter($event, day.key, timeSlot.key)"
                  @dragover="handleDragOver($event)"
                  @dragleave="handleDragLeave($event)"
                  @drop="handleDrop($event, day.key, timeSlot.key)"
                >
                  <!-- Cours existant -->
                  <div v-for="scheduleItem in [getScheduleItem(day.key, timeSlot.key)]" :key="scheduleItem?.id">
                    <div
                      v-if="scheduleItem"
                      :class="[
                        'schedule-item',
                        selectedClass?.type === 'PRIMARY' ? 'primary-schedule' : 'secondary-schedule'
                      ]"
                      :style="{ backgroundColor: getCourseColor(scheduleItem.courseId), '--bg-color': getCourseColor(scheduleItem.courseId) }"
                    >
                      <el-button
                        class="remove-btn"
                        type="danger"
                        :icon="Close"
                        size="small"
                        circle
                        @click="removeScheduleItem(day.key, timeSlot.key)"
                      />
                      <div class="item-content">
                        <!-- Affichage pour le primaire -->
                        <template v-if="selectedClass?.type === 'PRIMARY'">
                          <div class="professor-name-schedule">
                            {{ getProfessorById(scheduleItem.professorId)?.firstname }}
                          </div>
                          <div class="course-type">Enseignement général</div>
                        </template>
                        
                        <!-- Affichage pour le secondaire -->
                        <template v-else>
                          <div class="course-name">{{ getCourseById(scheduleItem.courseId)?.name }}</div>
                          <div class="professor-name">
                            {{ getProfessorById(scheduleItem.professorId)?.civility }}
                            {{ getProfessorById(scheduleItem.professorId)?.firstname }}
                          </div>
                        </template>
                      </div>
                    </div>
                    
                    <!-- Message de conflit -->
                    <div v-else-if="hasConflict(day.key, timeSlot.key)" class="conflict-message">
                      <el-icon color="#F56C6C"><Warning /></el-icon>
                      <span>Conflit détecté</span>
                    </div>

                    <!-- Zone de dépôt vide -->
                    <div v-else-if="day.enabled" class="empty-cell">
                      Glisser-déposer ici
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Légende -->
    <el-card class="legend-card" shadow="never">
      <template #header>
        <span>Légende</span>
      </template>
      
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-color drag-zone"></div>
          <span>Zone de dépôt active</span>
        </div>
        <div class="legend-item">
          <div class="legend-color disabled-day"></div>
          <span>Jour désactivé</span>
        </div>
        <div class="legend-item">
          <el-icon color="#F56C6C"><Warning /></el-icon>
          <span>Conflit horaire détecté</span>
        </div>
        <div class="legend-item">
          <el-icon color="#E6A23C"><Clock /></el-icon>
          <span>Durée du cours</span>
        </div>
        <div v-if="selectedClass?.type === 'PRIMARY'" class="legend-item">
          <el-icon color="#67C23A"><User /></el-icon>
          <span>Enseignement général (primaire)</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, User, Clock, Warning, Close } from '@element-plus/icons-vue'

// Types
interface Professor {
  id: number
  firstname: string
  lastname: string
  civility: string
  qualification?: { id: number; name: string }
  photo?: { id: number; name: string; type: string }
  teaching: Teaching[]
}

interface Teaching {
  id: number
  class: { id: number; name: string }
  course?: { id: number; name: string } // Optionnel pour le primaire
  schoolType: 'PRIMARY' | 'SECONDARY'
}

interface Class {
  id: number
  name: string
  type: 'PRIMARY' | 'SECONDARY'
}

interface Course {
  id: number | string
  name: string
}

interface ScheduleItem {
  id: string
  professorId: number
  courseId: number | string
  classId: number
  day: string
  timeSlot: string
}

interface TeachingItem {
  professor: Professor
  course: Course
  teaching: Teaching
}

// État réactif
const loading = ref(false)
const professors = ref<Professor[]>([])
const classes = ref<Class[]>([])
const schedule = ref<ScheduleItem[]>([])
const draggedItem = ref<TeachingItem | null>(null)
const dragOverCell = ref<string | null>(null)
const conflicts = ref<string[]>([])

const filters = reactive({
  selectedClassId: null as number | null
})

// Configuration des jours et créneaux
const days = ref([
  { key: 'lundi', label: 'Lundi', enabled: true },
  { key: 'mardi', label: 'Mardi', enabled: true },
  { key: 'mercredi', label: 'Mercredi', enabled: true },
  { key: 'jeudi', label: 'Jeudi', enabled: true },
  { key: 'vendredi', label: 'Vendredi', enabled: true },
  { key: 'samedi', label: 'Samedi', enabled: false },
  { key: 'dimanche', label: 'Dimanche', enabled: false }
])

const timeSlots = ref([
  { key: '8-9', label: '8h-9h' },
  { key: '9-10', label: '9h-10h' },
  { key: '10-11', label: '10h-11h' },
  { key: '11-12', label: '11h-12h' },
  { key: '14-15', label: '14h-15h' },
  { key: '15-16', label: '15h-16h' },
  { key: '16-17', label: '16h-17h' },
  { key: '17-18', label: '17h-18h' }
])

// Couleurs des matières
const courseColors = ref<Record<number, string>>({})

// Computed
const selectedClass = computed(() => {
  return classes.value.find(c => c.id === filters.selectedClassId)
})

const availableTeachingItems = computed((): TeachingItem[] => {
  if (!selectedClass.value) return []
  
  const items: TeachingItem[] = []
  
  professors.value.forEach(professor => {
    professor.teaching.forEach(teaching => {
      // Vérifier que la classe correspond
      if (teaching.class && teaching.class.id === selectedClass.value!.id) {
        
        if (selectedClass.value!.type === 'PRIMARY') {
          // Pour le primaire : le professeur peut enseigner (cours générique)
          items.push({
            professor,
            course: {
              id: `primary-${professor.id}`,
              name: 'Enseignement général'
            },
            teaching
          })
        } else {
          // Pour le secondaire : utiliser le cours spécifique
          if (teaching.course) {
            items.push({
              professor,
              course: teaching.course,
              teaching
            })
          } else {
            console.warn(`Cours manquant pour ${professor.firstname} ${professor.lastname} en secondaire`)
          }
        }
      }
    })
  })
  
  return items
})

// Méthodes API
const loadProfessors = async () => {
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('professor:all')
    if (result.success) {
      professors.value = result.data
      generateCourseColors()
    } else {
      throw new Error(result.message || 'Erreur lors du chargement des professeurs')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Erreur lors du chargement des professeurs")
  } finally {
    loading.value = false
  }
}

const loadClasses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all')
    if (result.success) {
      classes.value = result.data
      if (classes.value.length > 0) {
        filters.selectedClassId = classes.value[0].id
      }
    } else {
      throw new Error(result.message || 'Erreur lors du chargement des classes')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Erreur lors du chargement des classes")
  }
}

const loadSchedules = async () => {
  try {
    const result = await window.ipcRenderer.invoke('schedule:all')
    if (result.success) {
      schedule.value = result.data
    } else {
      throw new Error(result.message || 'Erreur lors du chargement des emplois du temps')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Erreur lors du chargement des emplois du temps")
  }
}

const saveScheduleItem = async (item: ScheduleItem) => {
  try {
    const payload: any = {
      professorId: item.professorId,
      classId: item.classId,
      day: item.day,
      timeSlot: item.timeSlot
    }
    
    // Pour le secondaire, inclure l'ID du cours spécifique
    if (selectedClass.value?.type === 'SECONDARY') {
      payload.courseId = item.courseId
    } else {
      // Pour le primaire, utiliser l'ID du teaching
      payload.teachingId = item.courseId
    }
    
    const result = await window.ipcRenderer.invoke('schedule:create', payload)
    
    if (result.success) {
      ElMessage.success('Cours ajouté avec succès')
      await loadSchedules()
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Erreur lors de la sauvegarde du cours")
  }
}

const deleteScheduleItem = async (scheduleId: string) => {
  try {
    const result = await window.ipcRenderer.invoke('schedule:delete', scheduleId)
    if (result.success) {
      ElMessage.success('Cours supprimé avec succès')
      await loadSchedules()
    } else {
      throw new Error(result.message || 'Erreur lors de la suppression')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Erreur lors de la suppression du cours")
  }
}

// Méthodes utilitaires
const generateCourseColors = () => {
  const colors = [
    '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399',
    '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'
  ]
  
  const allCourses = new Set<number>()
  professors.value.forEach(professor => {
    professor.teaching.forEach(teaching => {
      if (teaching.course) {
        allCourses.add(teaching.course.id)
      }
    })
  })
  
  Array.from(allCourses).forEach((courseId, index) => {
    courseColors.value[courseId] = colors[index % colors.length]
  })
}

const getCourseColor = (courseId: number | string): string => {
  if (selectedClass.value?.type === 'PRIMARY') {
    // Pour le primaire, couleur basée sur le professeur
    if (typeof courseId === 'string' && courseId.startsWith('primary-')) {
      const professorId = parseInt(courseId.replace('primary-', ''))
      const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8B5CF6', '#EC4899', '#10B981']
      return colors[professorId % colors.length]
    }
  }
  return courseColors.value[courseId as number] || '#409EFF'
}

const getCourseDuration = (courseId: number | string): number | null => {
  if (selectedClass.value?.type === 'PRIMARY') {
    // En primaire, les cours durent généralement 1h
    return 1
  } else {
    // En secondaire, durées variables selon la matière
    const coursesWithDuration: Record<number, number> = {}
    return coursesWithDuration[courseId as number] || null
  }
}

const getProfessorById = (id: number): Professor | undefined => {
  return professors.value.find(p => p.id === id)
}

const getCourseById = (id: number | string): Course | undefined => {
  if (selectedClass.value?.type === 'PRIMARY') {
    if (typeof id === 'string' && id.startsWith('primary-')) {
      return {
        id: id,
        name: 'Enseignement général'
      }
    }
  }
  
  for (const professor of professors.value) {
    for (const teaching of professor.teaching) {
      if (teaching.course && teaching.course.id === id) {
        return teaching.course
      }
    }
  }
  return undefined
}

const getPhotoUrl = (photo: { id: number; name: string; type: string }): string => {
  return `/api/files/${photo.id}/${photo.name}`
}

const getScheduleItem = (day: string, timeSlot: string): ScheduleItem | undefined => {
  return schedule.value.find(item => 
    item.day === day && 
    item.timeSlot === timeSlot && 
    item.classId === filters.selectedClassId
  )
}

const hasConflict = (day: string, timeSlot: string): boolean => {
  return conflicts.value.includes(`${day}-${timeSlot}`)
}

const checkConflicts = (newItem: ScheduleItem): boolean => {
  return schedule.value.some(item => 
    item.professorId === newItem.professorId &&
    item.day === newItem.day &&
    item.timeSlot === newItem.timeSlot &&
    item.classId !== newItem.classId
  )
}

// Gestionnaires d'événements
const toggleDay = (index: number) => {
  days.value[index].enabled = !days.value[index].enabled
}

const onClassChange = () => {
  // Recharger les données si nécessaire
}

const handleDragStart = (event: DragEvent, item: TeachingItem) => {
  draggedItem.value = item
  event.dataTransfer!.effectAllowed = 'move'
}

const handleDragEnter = (event: DragEvent, day: string, timeSlot: string) => {
  event.preventDefault()
  const dayObj = days.value.find(d => d.key === day)
  if (dayObj && dayObj.enabled) {
    dragOverCell.value = `${day}-${timeSlot}`
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDragLeave = (_event: DragEvent) => {
  dragOverCell.value = null
}

const handleDrop = async (event: DragEvent, day: string, timeSlot: string) => {
  event.preventDefault()
  dragOverCell.value = null
  
  if (!draggedItem.value || !selectedClass.value) return
  
  const dayObj = days.value.find(d => d.key === day)
  if (!dayObj || !dayObj.enabled) return
  
  let professorId = draggedItem.value.professor.id
  let courseId = draggedItem.value.course.id
  
  // Pour le primaire, utiliser l'ID du teaching
  if (selectedClass.value.type === 'PRIMARY') {
    if (typeof courseId === 'string' && courseId.startsWith('primary-')) {
      courseId = draggedItem.value.teaching.id
    }
  }
  
  const newItem: ScheduleItem = {
    id: Date.now().toString(),
    professorId: professorId,
    courseId: courseId,
    classId: selectedClass.value.id,
    day,
    timeSlot
  }
  
  // Vérifier les conflits
  if (checkConflicts(newItem)) {
    conflicts.value = [`${day}-${timeSlot}`]
    ElMessage.warning('Conflit détecté : ce professeur enseigne déjà à cette heure dans une autre classe')
    setTimeout(() => {
      conflicts.value = []
    }, 3000)
    return
  }
  
  // Supprimer l'ancien cours s'il existe
  const existingItem = getScheduleItem(day, timeSlot)
  if (existingItem) {
    await deleteScheduleItem(existingItem.id)
  }
  
  // Ajouter le nouveau cours
  await saveScheduleItem(newItem)
  draggedItem.value = null
}

const removeScheduleItem = async (day: string, timeSlot: string) => {
  const item = getScheduleItem(day, timeSlot)
  if (item) {
    try {
      await ElMessageBox.confirm('Êtes-vous sûr de vouloir supprimer ce cours ?', 'Confirmation', {
        type: 'warning'
      })
      await deleteScheduleItem(item.id)
    } catch {
      // Annulation
    }
  }
}

// Cycle de vie
onMounted(async () => {
  await Promise.all([
    loadProfessors(),
    loadClasses(),
    loadSchedules()
  ])
})
</script>

<style scoped>
.schedule-manager {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header-card {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-section h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.main-content {
  display: flex;
  gap: 20px;
  height: calc(100vh - 200px);
  overflow: hidden;
}

.sidebar {
  width: 300px;
  min-width: 300px;
  flex-shrink: 0;
}

.schedule-section {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.teachers-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.teachers-card .el-card__body {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.teachers-list {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.schedule-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.schedule-card .el-card__body {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.teachers-list {
  max-height: 600px;
  overflow-y: auto;
}

.teacher-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #EBEEF5;
  border-left: 4px solid #409EFF;
  border-radius: 6px;
  cursor: move;
  transition: all 0.3s;
  background: white;
}

.teacher-item:hover {
  background-color: #f5f7fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Styles pour l'école primaire */
.teacher-item.primary-item {
  border-left-width: 4px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fffe 100%);
}

.teacher-item.primary-item:hover {
  background: linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.professor-name-primary {
  font-weight: 700;
  color: #1f2937;
  font-size: 14px;
  margin-bottom: 4px;
}

.course-name-primary {
  font-size: 13px;
  color: #059669;
  font-weight: 500;
  background-color: #ecfdf5;
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-block;
  margin-bottom: 4px;
}

/* Styles pour l'école secondaire */
.teacher-item.secondary-item {
  border-left-width: 3px;
}

.teacher-item.secondary-item:hover {
  background-color: #f5f7fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.course-info {
  flex: 1;
}

.course-name {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.professor-name {
  font-size: 13px;
  color: #606266;
  margin-bottom: 2px;
}

.qualification {
  font-size: 12px;
  color: #909399;
}

.duration-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  margin-top: 4px;
}

.primary-item .duration-info {
  color: #059669;
}

.secondary-item .duration-info {
  color: #E6A23C;
}

.no-teachers {
  padding: 40px 20px;
  text-align: center;
}



/* Conteneur avec scroll horizontal */
.schedule-container {
  height: 100%;
  overflow: auto;
  width: 100%;
}

.schedule-header {
  display: flex;
  border-bottom: 2px solid #EBEEF5;
  background-color: #f5f7fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.time-header {
  padding: 16px 12px;
  font-weight: 600;
  color: #303133;
  border-right: 1px solid #EBEEF5;
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
  background-color: #f5f7fa;
}

.day-header {
  padding: 16px 12px;
  text-align: center;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border-right: 1px solid #EBEEF5;
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
}

.day-header.enabled {
  background-color: #409EFF;
  color: white;
}

.day-header.enabled:hover {
  background-color: #66b1ff;
}

.day-header.disabled {
  background-color: #f0f0f0;
  color: #c0c4cc;
}

.day-header.disabled:hover {
  background-color: #e5e5e5;
}

.enable-hint {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.7;
}

.schedule-grid {
  min-width: fit-content;
}

.schedule-row {
  display: flex;
  border-bottom: 1px solid #EBEEF5;
}

.time-slot {
  padding: 12px 8px;
  background-color: #f5f7fa;
  border-right: 1px solid #EBEEF5;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #606266;
  width: 100px;
  min-width: 100px;
  flex-shrink: 0;
  font-size: 13px;
}

.schedule-cell {
  padding: 6px;
  min-height: 70px;
  border-right: 1px solid #EBEEF5;
  position: relative;
  transition: all 0.3s;
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
}

.schedule-cell.disabled {
  background-color: #f0f0f0;
}

.schedule-cell.drag-over {
  background-color: #ecf5ff;
  border: 2px dashed #409EFF;
}

.schedule-cell.has-conflict {
  background-color: #fef0f0;
  border: 2px solid #f56c6c;
}

.schedule-item {
  position: relative;
  padding: 8px;
  border-radius: 6px;
  color: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 64px;
}

.remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 10;
}

.schedule-item:hover .remove-btn {
  opacity: 1;
}

.item-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.item-content .course-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
  word-wrap: break-word;
}

.item-content .professor-name {
  font-size: 11px;
  opacity: 0.9;
}

.item-content .professor-name-schedule {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}

.item-content .course-type {
  font-size: 11px;
  opacity: 0.9;
}

.conflict-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #F56C6C;
  font-size: 12px;
  text-align: center;
  height: 100%;
  flex-wrap: wrap;
}

.empty-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  height: 100%;
  border: 2px dashed #e4e7ed;
  border-radius: 4px;
  transition: all 0.3s;
}

.empty-cell:hover {
  border-color: #c0c4cc;
  color: #909399;
}

.legend-card {
  margin-top: 20px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-color.drag-zone {
  background-color: #ecf5ff;
  border: 2px dashed #409EFF;
}

.legend-color.disabled-day {
  background-color: #f0f0f0;
}

/* Responsive */
@media (max-width: 1400px) {
  .sidebar {
    width: 280px;
    min-width: 280px;
  }
  
  .time-header,
  .time-slot {
    width: 90px;
    min-width: 90px;
  }
  
  .day-header,
  .schedule-cell {
    width: 120px;
    min-width: 120px;
  }
}

@media (max-width: 1200px) {
  .main-content {
    flex-direction: column;
    height: auto;
    gap: 15px;
  }
  
  .sidebar {
    width: 100%;
    min-width: unset;
  }
  
  .teachers-card {
    height: 300px;
  }
  
  .schedule-section {
    min-width: unset;
  }
  
  .schedule-card {
    height: 600px;
  }
}

@media (max-width: 768px) {
  .schedule-manager {
    padding: 10px;
  }
  
  .main-content {
    gap: 10px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .time-header,
  .time-slot {
    padding: 8px 6px;
    font-size: 12px;
    width: 80px;
    min-width: 80px;
  }
  
  .day-header,
  .schedule-cell {
    padding: 8px 4px;
    font-size: 12px;
    width: 100px;
    min-width: 100px;
  }
  
  .schedule-cell {
    min-height: 60px;
    padding: 4px;
  }
  
  .teachers-card {
    height: 250px;
  }
  
  .schedule-card {
    height: 500px;
  }
  
  .legend-items {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .item-content .course-name,
  .item-content .professor-name-schedule {
    font-size: 11px;
  }
  
  .item-content .professor-name,
  .item-content .course-type {
    font-size: 10px;
  }
}

/* Améliorations pour le scroll horizontal */
.schedule-container::-webkit-scrollbar {
  height: 8px;
}

.schedule-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.schedule-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.schedule-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Animation pour les éléments déplacés */
.schedule-item {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Styles pour les différents types d'écoles */
.primary-schedule {
  background: linear-gradient(135deg, var(--bg-color), rgba(255,255,255,0.1));
  border: 1px solid rgba(255,255,255,0.2);
}

.secondary-schedule {
  background: var(--bg-color);
}

/* Indicateur visuel pour le scroll */
.schedule-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(to left, rgba(0,0,0,0.1), transparent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.schedule-card:hover::after {
  opacity: 1;
}
</style>