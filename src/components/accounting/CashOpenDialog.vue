<template>
  <el-dialog v-model="open" title="Ouverture de caisse" width="420px" @close="close">
    <el-form label-width="140px">
      <el-form-item label="Fond d'ouverture">
        <el-input-number v-model="fond" :min="0" :step="5000" style="width: 100%" controls-position="right" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">Annuler</el-button>
      <el-button type="primary" :loading="saving" @click="confirm">Ouvrir</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'confirm', fond: number): void }>()
const saving = ref(false)
const fond = ref(500000)

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

function close(): void {
  emit('update:visible', false)
}

function confirm(): void {
  saving.value = true
  try {
    emit('confirm', fond.value)
    ElMessage.success('Caisse ouverte')
    close()
  } finally {
    saving.value = false
  }
}
</script>
