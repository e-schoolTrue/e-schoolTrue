<script lang="ts" setup>
import {ElTable} from 'element-plus'
import {reactive, ref, computed} from 'vue'
import {Icon} from "@iconify/vue";
import {Course} from "@/types/course";

const props = defineProps<{
  courses: Course[]
}>();
const searchForm = ref("")
const paginator = reactive<{
  totalPage:number
  pageSize:number
  currentPage:number
}>({
  totalPage:0,
  pageSize:5 ,
  currentPage:1
})
// const courseDetailsRef = ref()
const filteredCourses = computed(()=>{
  const result =  props.courses?.filter((course: Course)=>Object.values(course).some((value:any)=>String(value).toLowerCase().includes(searchForm.value.toLowerCase()))) || []
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize)
})
const emits=defineEmits<{
  (e:"openUpdateForm" , course: Course):void,
  (e:"deleteAction" , id:number):void,
}>()

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-scrollbar  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-text type="primary" style="font-size: 18px">Les sous matières</el-text>
      <el-input placeholder="Rechercher une sous-matière..." v-model="searchForm">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="filteredCourses"  style="max-width: 800px"  :border="false" empty-text="Aucune sous-matière trouvée">
        <el-table-column type="index" width="50" />
        <el-table-column label="Code"  prop="code" width="120"/>
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Coefficient" prop="coefficient" width="100" align="center"/>
        <el-table-column label="Actions" width="200" align="center">
          <template #default="scope">
            <el-space >
              <el-button size="small" type="primary" @click="emits('openUpdateForm', scope.row)" >Modifier</el-button>
              <el-button size="small" type="danger" @click="emits('deleteAction' , scope.row?.id as number)">Supprimer</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
          v-if="paginator.totalPage > 0"
          :page-count="paginator.totalPage"
          :page-size="paginator.pageSize" 
          :current-page="paginator.currentPage"
          @current-change="handleCurrentPage"
          style=" display:flex ; justify-content: center; width: 100%; margin-top: 20px;" background layout="prev, pager, next" 
          :total="filteredCourses.length"
      />
    </el-space>
  </el-scrollbar>
</template>

<style scoped>

</style>