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
          <el-select v-model.number="form.startHour" style="width: 150px">
            <el-option v-for="h in 12" :key="h + 5" :label="`${h + 5}h`" :value="h + 5" />
          </el-select>
        </el-form-item>

        <el-form-item label="Heure de fin">
          <el-select v-model.number="form.endHour" style="width: 150px">
            <el-option v-for="h in 8" :key="h + 12" :label="`${h + 12}h`" :value="h + 12" />
          </el-select>
        </el-form-item>

        <el-form-item label="Durée d'un créneau">
          <el-select v-model.number="form.slotDuration" style="width: 150px">
            <el-option label="1 heure (60 min)" :value="60" />
            <el-option label="2 heures (120 min)" :value="120" />
            <el-option label="3 heures (180 min)" :value="180" />
          </el-select>
        </el-form-item>

        <el-divider />
        <h3>Pause déjeuner</h3>

        <el-form-item label="Début de la pause">
          <el-select v-model.number="form.lunchStart" style="width: 150px">
            <el-option v-for="h in 4" :key="h + 10" :label="`${h + 10}h`" :value="h + 10" />
          </el-select>
        </el-form-item>

        <el-form-item label="Fin de la pause">
          <el-select v-model.number="form.lunchEnd" style="width: 150px">
            <el-option v-for="h in 4" :key="h + 12" :label="`${h + 12}h`" :value="h + 12" />
          </el-select>
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
  endHour: 18,
  slotDuration: 60,
  lunchStart: 12,
  lunchEnd: 14
})

const previewSlots = computed(() => {
  const slots: { key: string; label: string }[] = []
  let h = form.startHour
  while (h < form.endHour) {
    if (h >= form.lunchStart && h < form.lunchEnd) {
      h = form.lunchEnd
      continue
    }
    const endH = h + form.slotDuration / 60
    if (endH > form.endHour) break
    slots.push({ key: `${h}-${endH}`, label: `${h}h - ${endH}h` })
    h = endH
  }
  return slots
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
    form.startHour = result.data.startHour
    form.endHour = result.data.endHour
    form.slotDuration = result.data.slotDuration
    form.lunchStart = result.data.lunchStart
    form.lunchEnd = result.data.lunchEnd
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
