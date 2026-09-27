<template>
  <div class="relance">
    <el-tooltip content="Numéro manquant — relance +224 impossible" placement="top" :disabled="hasPhone">
      <span>
        <el-button :size="compact ? 'small' : 'default'" type="success" :disabled="!hasPhone" @click="whatsapp">
          <Icon icon="mdi:whatsapp" /> WhatsApp
        </el-button>
      </span>
    </el-tooltip>
    <el-tooltip content="Numéro manquant — relance +224 impossible" placement="top" :disabled="hasPhone">
      <span>
        <el-button :size="compact ? 'small' : 'default'" :disabled="!hasPhone" @click="sms">
          <Icon icon="mdi:message-text-outline" /> SMS
        </el-button>
      </span>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useArrears } from '@/composables/useArrears'

const props = defineProps<{
  phone?: string
  firstname: string
  lastname?: string
  parent?: string
  classe?: string
  echeance?: string
  reste: number
  schoolYear?: string
  schoolName?: string
  compact?: boolean
}>()

const { buildGuineeMessage, normalizeGuineePhone } = useArrears()

const hasPhone = computed(() => normalizeGuineePhone(props.phone) !== '')

async function message(): Promise<string> {
  return buildGuineeMessage({
    firstname: props.firstname,
    lastname: props.lastname,
    parent: props.parent,
    classe: props.classe,
    echeance: props.echeance,
    reste: props.reste,
    schoolYear: props.schoolYear,
    schoolName: props.schoolName,
  })
}

async function whatsapp(): Promise<void> {
  const num = normalizeGuineePhone(props.phone)
  if (!num) {
    ElMessage.warning('Numéro de téléphone manquant')
    return
  }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(await message())}`, '_blank')
}

async function sms(): Promise<void> {
  const num = normalizeGuineePhone(props.phone)
  if (!num) {
    ElMessage.warning('Numéro de téléphone manquant')
    return
  }
  window.location.href = `sms:+${num}?body=${encodeURIComponent(await message())}`
}
</script>

<style scoped>
.relance { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
</style>
