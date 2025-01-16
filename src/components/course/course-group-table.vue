<script setup lang="ts">
import {ElTable} from 'element-plus'
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";
import {ClassRoomCommand} from "#electron/command/settingsCommand.ts";
import {CourseEntity} from "#electron/backend/entities/course.ts";

const props = defineProps<{courses:CourseEntity[]}>()
const searchForm = ref("")
const paginator = reactive<{
  totalPage:number
  pageSize:number
  currentPage:number
}>({
  totalPage:0,
  pageSize:2 ,
  currentPage:1
})
// const courseDetailsRef = ref()
const filteredCourses = computed(()=>{
  const result =  props.courses?.filter((course:CourseEntity)=>Object.keys(course).some((key:string)=>String((course as any)[key]).toLowerCase().includes(searchForm.value.toLowerCase()))) || []
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize)
})
const emits=defineEmits<{
  (e:"openUpdateForm" , classRoom:ClassRoomCommand):any,
  (e:"deleteAction" , id:number):any,
}>()

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-scrollbar  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-text type="primary" style="font-size: 18px">Les sous matières</el-text>
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
        <el-table-column label="Actions" width="250">
          <template #default="scope">
            <el-space >
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