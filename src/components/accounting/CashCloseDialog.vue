<template>
  <el-dialog v-model="open" title="Clôture de caisse" width="460px" @close="close">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="Solde théorique"><CurrencyDisplay :amount="theorique" /></el-descriptions-item>
    </el-descriptions>
    <el-form label-width="140px" style="margin-top: 12px">
      <el-form-item label="Solde réel compté">
        <el-input-number v-model="reel" :min="0" :step="1000" style="width: 100%" controls-position="right" />
      </el-form-item>
      <el-alert v-if="ecart !== 0" :title="`Écart : ${formattedEcart}`" :type="ecart === 0 ? 'success' : 'warning'" show-icon />
    </el-form>
    <template #footer>
      <el-button @click="close">Annuler</el-button>
      <el-button type="primary" @click="confirm">Clôturer</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue'
import { useCurrency } from '@/composables/useCurrency'

const props = defineProps<{ visible: boolean; theorique: number }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'confirm', reel: number): void }>()

const reel = ref(props.theorique)
watch(() => props.theorique, (v) => { reel.value = v })

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

const ecart = computed(() => reel.value - props.theorique)
const formattedEcart = computed(() => {
  const { formatMoney } = useCurrency()
  return formatMoney(ecart.value)
})

function close(): void {
  emit('update:visible', false)
}

function confirm(): void {
  emit('confirm', reel.value)
  close()
}
</script>
