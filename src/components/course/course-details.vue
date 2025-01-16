<script lang="ts" setup>
import {ref} from 'vue'
import {Icon} from "@iconify/vue";
import {CourseEntity} from "#electron/backend/entities/course.ts";
import CourseGroupTable from "@/components/course/course-group-table.vue";
import CourseGroupForm from "@/components/course/course-group-form.vue";

const dialogVisible = ref(false)
const course = ref<CourseEntity>()
function open(_course:CourseEntity){
  dialogVisible.value = true
  course.value = _course
}
function close(){
  dialogVisible.value = false
}


defineExpose({
  open,
  close
})
</script>


<template>
  <el-dialog
      v-model="dialogVisible"
      width="850"
  >
    <template #header>
      <el-space direction="horizontal">
        <Icon icon="ei:plus" color="#32CD32" width="20"/>
        <el-text size="large" type="primary">Détails de la matière</el-text>
      </el-space>
    </template>
    <template #default>
      <course-group-form
          ref="newCourseGroupFormRef"
          form-title="Nouvelle sous matière"
      />
      <el-space direction="vertical" fill="fill">
        <el-descriptions title="Info Matière">
          <el-descriptions-item>
            <template #label>
              <el-space>
                <el-text style="font-weight: bold">Code:</el-text>
                <el-tag type="info">{{course?.code}}</el-tag>
              </el-space>
            </template>
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              <el-space>
                <el-text style="font-weight: bold">Nom:</el-text>
                <el-tag type="info">{{course?.name}}</el-tag>
              </el-space>
            </template>
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              <el-space>
                <el-text style="font-weight: bold">Coefficient:</el-text>
                <el-tag type="info">{{course?.coefficient}}</el-tag>
              </el-space>
            </template>
          </el-descriptions-item>
        </el-descriptions>
        <course-group-table :courses="course?.courses || []" v-if="!course?.isInGroupement"/>
      </el-space>
    </template>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="dialogVisible = false">
          OK
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>

</style>