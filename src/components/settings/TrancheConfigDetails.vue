<script setup lang="ts">
  import { ref } from 'vue'
  import { extractDateFormat, type ComponentSize } from 'element-plus'
  // @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';
  
  const size = ref<ComponentSize>('default')
  const props = defineProps<{ dialog: boolean, config:PaymentAnnualConfigEntity }>()

  
  const emit = defineEmits<{
    (e: 'closeDialog'): void
  }>()
</script>

<template>
    <el-dialog 
        v-model="props.dialog" 
        title="Details de la tranche" 
        width="900px"
        destroy-on-close
      >
        <el-descriptions
        class="margin-top"
        title="Tranche"
        :column="2"
        :size="size"
        border
        >
        <el-descriptions-item>
            <template #label>
              <el-space>
                <Icon icon="octicon:book-16" />
                <el-text>Classe</el-text>
              </el-space>
            </template>
            {{ props.config.grade?.name }}
        </el-descriptions-item>
        <el-descriptions-item>
            <template #label>
              <el-text>Nombre de tranche</el-text>
            </template>
            {{ props.config.trancheCount }}
        </el-descriptions-item>
        <el-descriptions-item v-for="tranche in props.config.tranches" :key="tranche.id">
            <template #label>
              <el-text>{{ tranche.tranchName }}</el-text>
            </template>
            <el-space direction="vertical">
              <el-space direction="horizontal">
                <el-text>-Nombre de mois:</el-text>
                <el-text>{{ tranche.tranchMonthCount }}</el-text>
              </el-space>
              <el-space direction="horizontal" v-for="entry in tranche.entries" :key="entry.id">
                <el-text>-Mois {{ entry.id }}:</el-text>
                <el-text>{{ extractDateFormat(entry.startDate?.toString() || '') }}</el-text>
                <el-text>{{ extractDateFormat(entry.endDate?.toString() || '') }}</el-text>
              </el-space>
            </el-space>
        </el-descriptions-item>
        
        </el-descriptions>
    
        <template #footer>
          <el-button type="primary" @click="emit('closeDialog')">Ok</el-button>
        </template>
    </el-dialog>
</template>
  
  <style scoped>
  .el-descriptions {
    margin-top: 20px;
  }
  .cell-item {
    display: flex;
    align-items: center;
  }
  .margin-top {
    margin-top: 20px;
  }
  </style>