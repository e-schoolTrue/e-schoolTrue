<script setup lang="ts">

import {Icon} from "@iconify/vue";
import {ref} from "vue";
import {GradeEntity} from "#electron/backend/entities/grade.ts";

const currGrade = ref<GradeEntity>()
const dialogVisible = ref(false)

function open(grade:GradeEntity){
  currGrade.value = grade
  dialogVisible.value = true
}
function close(){
  dialogVisible.value = false
}

defineExpose({
  open ,
  close
})
</script>

<template>
  <el-dialog v-model="dialogVisible" width="500">
    <template #header>
      <el-space direction="horizontal">
        <Icon icon="ei:plus" color="#32CD32" width="20"/>
        <el-text size="large" type="primary">Détails</el-text>
      </el-space>
    </template>
    <el-descriptions title="Info Niveau">
      <el-descriptions-item >
        <template #label>
          <el-text type="primary" style="font-weight: bold">Code:</el-text>
        </template>
        <el-tag>{{currGrade?.code}}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item >
        <template #label>
          <el-text type="primary" style="font-weight: bold">Nom:</el-text>
        </template>
        <el-tag>{{currGrade?.name}}</el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary"  @click="dialogVisible = false">OK</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>

</style>