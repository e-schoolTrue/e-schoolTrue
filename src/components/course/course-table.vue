<script setup lang="ts">
import {ElTable, FormInstance} from 'element-plus'
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";
import {ClassRoomCommand, CourseCommand} from "#electron/command/settingsCommand.ts";
import {CourseEntity} from "#electron/backend/entities/course.ts";
import CourseDetails from "@/components/course/course-details.vue";
import CourseGroupForm from "@/components/course/course-group-form.vue";

const props = defineProps<{courses:CourseEntity[]}>()
const searchForm = ref("")
const newCourseGroupFormRef = ref()
const paginator = reactive<{
  totalPage:number
  pageSize:number
  currentPage:number
}>({
  totalPage:0,
  pageSize:5 ,
  currentPage:1
})
const courseDetailsRef = ref()
const filteredCourses = computed(()=>{
  const result =  props.courses?.filter((course:CourseEntity)=>Object.keys(course).some((key:string)=>String(course[key]).toLowerCase().includes(searchForm.value.toLowerCase()))) || []
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize)
})
const emits=defineEmits<{
  (e:"openUpdateForm" , classRoom:ClassRoomCommand):any,
  (e:"addCourseGroup" , formRef:FormInstance , form:CourseCommand):any,
  (e:"deleteAction" , id:number):any,
}>()

function addCourseGroup(formRef: FormInstance, form: ClassRoomCommand){
  emits("addCourseGroup" , formRef , form)
  newCourseGroupFormRef.value.close()
}

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-scrollbar height="530"  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <course-details
        ref="courseDetailsRef"
    />
    <course-group-form
        ref="newCourseGroupFormRef"
        form-title="Nouvelle sous matière"
        @submit-action="addCourseGroup"
    />
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-input placeholder="tapez quelques chose!" v-model="searchForm">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="filteredCourses"  style="max-width: 800px"  :border="false" empty-text="aucune matière trouvée">
        <el-table-column type="index" />
        <el-table-column label="Code"  prop="code"/>
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Coefficient" prop="coefficient" />
        <el-table-column label="Groupe de matière" >
          <template #default="scope">
            <el-checkbox :checked="scope.row?.courses.length>0" :disabled="true" size="large" />
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="280">
          <template #default="scope">
            <el-space >
              <el-dropdown placement="top-start">
                <el-button size="small" type="danger" >
                  <Icon icon="hugeicons:more-03"/>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>
                      <el-space>
                        <Icon icon="twemoji:woman-teacher"/>
                        <el-text>Ajout d'un enseignants de la matière</el-text>
                      </el-space>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!scope.row?.isInGroupement" @click="newCourseGroupFormRef.open(scope.row)">
                      <el-space>
                        <Icon icon="vscode-icons:folder-type-module"/>
                        <el-text>Ajout d'une sous matière</el-text>
                      </el-space>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip
                  class="box-item"
                  effect="dark"
                  content="Détails de la matière"
                  placement="top-start"
              >
                <el-button size="small" type="warning" @click="courseDetailsRef.open(scope.row)" >
                  <Icon icon="ph:eye-fill"/>
                </el-button>
              </el-tooltip>
              <el-button size="small" type="primary" @click="emits('openUpdateForm', scope.row)" >Modifier</el-button>
              <el-button size="small" type="danger" @click="emits('deleteAction' , scope.row?.id)">Supprimer</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
          :page-count="paginator.totalPage"
          :page-size="paginator.pageSize"
          :current-page="paginator.currentPage"
          @current-change="handleCurrentPage"
          style=" display:flex ; justify-content: center; width: 600px" background layout="prev, pager, next" :total="1000"
      />
    </el-space>
  </el-scrollbar>
</template>

<style scoped>

</style>