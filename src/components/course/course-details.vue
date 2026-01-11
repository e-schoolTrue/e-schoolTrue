<script lang="ts" setup>
import {ref} from 'vue'
import {Icon} from "@iconify/vue";
import {Course} from "@/types/course";
import CourseGroupTable from "@/components/course/course-group-table.vue";
import CourseGroupForm from "@/components/course/course-group-form.vue";

const dialogVisible = ref(false)
const course = ref<Course>()
function open(_course:Course){
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
      <el-space direction="vertical" fill="fill" style="width: 100%">
        <el-descriptions title="Info Matière" :column="2" border>
          <el-descriptions-item label="Code">
            <el-tag type="info">{{course?.code}}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Nom">
            <el-tag type="info">{{course?.name}}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Coefficient">
            <el-tag type="info">{{course?.coefficient}}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Type">
            <el-tag :type="course?.isInGroupement ? 'warning' : 'success'">
              {{course?.isInGroupement ? 'Sous-matière' : 'Matière principale'}}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- Section Classes affectées -->
        <el-card v-if="course?.grades && course.grades.length > 0" shadow="hover">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <Icon icon="mdi:school" width="20" color="#409EFF"/>
              <el-text size="large" style="font-weight: 600;">Classes affectées</el-text>
              <el-tag type="primary" size="small">{{ course.grades.length }}</el-tag>
            </div>
          </template>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <el-tag
              v-for="grade in course.grades"
              :key="grade.id"
              size="large"
              type="success"
              effect="plain"
              style="font-size: 14px; padding: 8px 16px;"
            >
              <Icon icon="mdi:google-classroom" style="margin-right: 6px;"/>
              {{ grade.name }} ({{ grade.code }})
            </el-tag>
          </div>
        </el-card>

        <!-- Section Classes affectées (ancienne méthode de compatibilité) -->
        <el-card v-else-if="course?.grade" shadow="hover">
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px;">
              <Icon icon="mdi:school" width="20" color="#409EFF"/>
              <el-text size="large" style="font-weight: 600;">Classe affectée</el-text>
            </div>
          </template>
          <el-tag size="large" type="success" effect="plain">
            <Icon icon="mdi:google-classroom" style="margin-right: 6px;"/>
            {{ course.grade.name }} ({{ course.grade.code }})
          </el-tag>
        </el-card>

        <!-- Message si aucune classe -->
        <el-alert
          v-else
          title="Aucune classe affectée"
          type="warning"
          description="Cette matière n'est pas encore affectée à une classe."
          :closable="false"
          show-icon
        />

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