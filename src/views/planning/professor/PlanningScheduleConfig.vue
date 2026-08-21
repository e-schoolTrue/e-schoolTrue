<template>
  <div class="schedule-config">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon :size="28" color="#409EFF"><Timer /></el-icon>
          <h1>Configuration des Créneaux Horaires</h1>
        </div>
      </template>

      <el-form :model="form" label-width="220px" class="config-form">
        <el-form-item label="Type de configuration">
          <el-radio-group v-model="form.global">
            <el-radio :value="true" border>Appliquer à toutes les classes</el-radio>
            <el-radio :value="false" border>Configurer par classe</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Classe" v-if="!form.global">
          <el-select v-model="form.classId" placeholder="Sélectionner une classe" style="width: 300px">
            <el-option v-for="cls in classes" :key="cls.id" :label="cls.name" :value="cls.id" />
          </el-select>
        </el-form-item>

        <el-divider />

        <el-form-item label="Heure de début">
          <el-time-picker
            v-model="startTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="08:00"
            style="width: 150px"
            :clearable="false"
          />
        </el-form-item>

        <el-form-item label="Heure de fin">
          <el-time-picker
            v-model="endTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="18:00"
            style="width: 150px"
            :clearable="false"
          />
        </el-form-item>

        <el-form-item label="Durée d'un créneau">
          <el-input-number v-model="form.slotDuration" :min="15" :step="15" :max="180" style="width: 150px" />
          <span style="margin-left: 12px; color: #909399; font-size: 12px">{{ form.slotDuration }} min</span>
          <el-select v-model.number="form.slotDuration" placeholder="Rapide" style="width: 140px; margin-left: 12px">
            <el-option label="15 min" :value="15" />
            <el-option label="30 min" :value="30" />
            <el-option label="45 min" :value="45" />
            <el-option label="60 min" :value="60" />
            <el-option label="90 min" :value="90" />
            <el-option label="120 min" :value="120" />
            <el-option label="180 min" :value="180" />
          </el-select>
        </el-form-item>

        <el-divider />
        <h3>Pause déjeuner</h3>

        <el-form-item label="Début de la pause">
          <el-time-picker
            v-model="lunchStartTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="12:00"
            style="width: 150px"
            :clearable="false"
          />
        </el-form-item>

        <el-form-item label="Fin de la pause">
          <el-time-picker
            v-model="lunchEndTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="14:00"
            style="width: 150px"
            :clearable="false"
          />
        </el-form-item>

        <el-divider />

        <el-form-item label="Aperçu des créneaux">
          <div class="slot-preview">
            <el-tag v-for="slot in previewSlots" :key="slot.key" class="slot-tag" effect="plain">
              {{ slot.label }}
            </el-tag>
            <span v-if="previewSlots.length === 0" class="no-slots">Aucun créneau généré</span>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveConfig" :loading="saving">
            <Icon icon="mdi:content-save" class="mr-2" /> Enregistrer
          </el-button>
          <el-button @click="loadConfig">Annuler</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Timer } from '@element-plus/icons-vue'
import { generateSlots } from '@/composables/useScheduleSlots'

interface ClassItem {
  id: number
  name: string
}

const classes = ref<ClassItem[]>([])
const saving = ref(false)

const form = reactive({
  global: true,
  classId: null as number | null,
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

const pad = (n: number) => String(n).padStart(2, '0')

const startTime = computed({
  get: () => `${pad(form.startHour)}:${pad(form.startMinutes ?? 0)}`,
  set: (val: string) => {
    if (!val) return
    const [h, m] = val.split(':').map(Number)
    if (!Number.isNaN(h)) form.startHour = h
    form.startMinutes = Number.isNaN(m) ? 0 : m
  }
})

const endTime = computed({
  get: () => `${pad(form.endHour)}:${pad(form.endMinutes ?? 0)}`,
  set: (val: string) => {
    if (!val) return
    const [h, m] = val.split(':').map(Number)
    if (!Number.isNaN(h)) form.endHour = h
    form.endMinutes = Number.isNaN(m) ? 0 : m
  }
})

const lunchStartTime = computed({
  get: () => `${pad(form.lunchStart)}:${pad(form.lunchStartMinutes ?? 0)}`,
  set: (val: string) => {
    if (!val) return
    const [h, m] = val.split(':').map(Number)
    if (!Number.isNaN(h)) form.lunchStart = h
    form.lunchStartMinutes = Number.isNaN(m) ? 0 : m
  }
})

const lunchEndTime = computed({
  get: () => `${pad(form.lunchEnd)}:${pad(form.lunchEndMinutes ?? 0)}`,
  set: (val: string) => {
    if (!val) return
    const [h, m] = val.split(':').map(Number)
    if (!Number.isNaN(h)) form.lunchEnd = h
    form.lunchEndMinutes = Number.isNaN(m) ? 0 : m
  }
})

const previewSlots = computed(() => {
  return generateSlots(form)
})

const loadClasses = async () => {
  const result = await window.ipcRenderer.invoke('grade:all')
  if (result.success) {
    classes.value = result.data || []
  }
}

const loadConfig = async () => {
  const result = await window.ipcRenderer.invoke('schedule-config:get', { classId: form.global ? null : form.classId })
  if (result.success && result.data) {
    form.startHour = result.data.startHour ?? 8
    form.startMinutes = result.data.startMinutes ?? 0
    form.endHour = result.data.endHour ?? 18
    form.endMinutes = result.data.endMinutes ?? 0
    form.slotDuration = result.data.slotDuration ?? 60
    form.lunchStart = result.data.lunchStart ?? 12
    form.lunchStartMinutes = result.data.lunchStartMinutes ?? 0
    form.lunchEnd = result.data.lunchEnd ?? 14
    form.lunchEndMinutes = result.data.lunchEndMinutes ?? 0
  }
}

const saveConfig = async () => {
  saving.value = true
  try {
    const result = await window.ipcRenderer.invoke('schedule-config:save', { ...form })
    if (result.success) {
      ElMessage.success('Configuration enregistrée')
    } else {
      ElMessage.error(result.message || 'Erreur lors de l\'enregistrement')
    }
  } catch (error) {
    ElMessage.error('Erreur lors de l\'enregistrement')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadClasses()
  loadConfig()
})
</script>

<style scoped>
.schedule-config {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.config-form {
  margin-top: 20px;
}
.slot-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.slot-tag {
  font-size: 14px;
  padding: 4px 12px;
}
.no-slots {
  color: #909399;
  font-style: italic;
}
.mr-2 {
  margin-right: 8px;
}
</style>
