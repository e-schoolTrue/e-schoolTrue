<script setup lang="ts">
import {ElTable} from 'element-plus'
import {BranchEntity, GradeEntity} from "@electron/entities/grade.ts";
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";
import BranchTable from "@/components/grade/branch-table.vue";

const props = defineProps<{grades:GradeEntity[]}>()
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
const filteredGrades = computed(()=>{
  const result =  props.grades?.filter((grade:GradeEntity)=>Object.keys(grade).some((key:string)=>String(grade[key]).toLowerCase().includes(searchForm.value.toLowerCase()))) || []
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize)
})
const emits=defineEmits<{
  (e:"openUpdateForm" , grade:GradeEntity),
  (e:"deleteAction" , id:number),
  (e:"openNestedNewForm" , grade:GradeEntity),
  (e:"openNestedUpdateForm" , branch:BranchEntity , grade:GradeEntity),
  (e:"deleteNestedAction" , id:number),
}>()

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-scrollbar height="530"  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-space size="large">
        <Icon width="25" icon="material-symbols:grade-outline"  color="#32CD32"/>
        <el-text type="primary" style="font-size: 20px">Niveaux</el-text>
      </el-space>
      <el-input placeholder="tapez quelques chose!" v-model="searchForm">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="filteredGrades"  style="max-width: 800px"  :border="false" empty-text="aucun niveaux trouvé">
        <el-table-column type="expand" >
          <template #default="scope">
            <branch-table
                :brnaches="scope.row?.branches"
                @open-update-form="(branch:BranchEntity)=>emits('openNestedUpdateForm' , branch , scope.row)"
                @delete-action="(id:number)=>emits('deleteNestedAction' , id)"
            />
          </template>
        </el-table-column>
        <el-table-column type="index" width="50" />
        <el-table-column label="Code" prop="code" width="80" />
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Actions" >
          <template #default="scope">
            <el-space>
              <el-button size="small" type="info" @click="emits('openNestedNewForm' , scope.row)" >
                <el-space>
                  <Icon icon="icons8:plus"/>
                  <el-text>branche</el-text>
                </el-space>
              </el-button>
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