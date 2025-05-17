<script setup lang="ts">
import {ElTable} from 'element-plus'
import {ClassRoomEntity} from "#electron/backend/entities/grade.ts";
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";
import {ClassRoomCommand} from "#electron/command/settingsCommand.ts";
import GradeDetail from "@/components/grade/grade-detail.vue";

const props = defineProps<{classRooms:ClassRoomEntity[]}>()
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
const filteredClassRooms = computed(() => {
  if (!Array.isArray(props.classRooms)) return []
  const result = props.classRooms.filter(classRoom => 
    (classRoom?.name ?? '').toLowerCase().includes(searchForm.value.toLowerCase())
  )
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize)
})
const gradeDetailsRef = ref()
const emits=defineEmits<{
  (e:"openUpdateForm" , classRoom:ClassRoomCommand):void,
  (e:"deleteAction" , id:number):void,
}>()

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-scrollbar height="530"  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <grade-detail ref="gradeDetailsRef" />
    <el-space direction="vertical" fill="fill" style=" width: 700px">
      <el-input placeholder="tapez quelques chose!" v-model="searchForm">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="filteredClassRooms"  style="max-width: 700px"  :border="false" empty-text="aucune salle de class trouvée">
        <el-table-column type="index" />
        <el-table-column label="Code"  prop="code"/>
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Capacité" prop="capacity" />
        <el-table-column label="Niveau" >
          <template #default="scope">
            <el-tag type="primary" size="large" @click="gradeDetailsRef.open(scope.row?.grade)">
              <el-link type="primary">{{scope.row?.grade?.name}}</el-link>
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200">
          <template #default="scope">
            <el-space >
              <el-button type="primary" @click="emits('openUpdateForm', scope.row)" >Modifier</el-button>
              <el-button type="danger" @click="emits('deleteAction' , scope.row?.id)">Supprimer</el-button>
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