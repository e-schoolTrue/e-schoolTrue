<script setup lang="ts">
import {ElTable} from 'element-plus'
import {BranchEntity} from "#electron/backend/entities/grade.ts";
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";

const props = defineProps<{brnaches:BranchEntity[]}>()
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
const filteredGrades = computed(() => {
  const searchValue = searchForm.value.toLowerCase();
  const result = props.brnaches?.filter((branch: BranchEntity) => 
    (branch.name?.toLowerCase() || '').includes(searchValue) || 
    (branch.code?.toLowerCase() || '').includes(searchValue)
  ) || [];
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize);
  return result.slice((paginator.currentPage - 1) * paginator.pageSize, paginator.currentPage * paginator.pageSize);
});
const emits = defineEmits<{
  (e: "openUpdateForm", branch: BranchEntity): void,
  (e: "deleteAction", id: number): void
}>();

function handleCurrentPage(pageNumber:number){
  paginator.currentPage = pageNumber
}
</script>

<template>
  <el-space direction="vertical" fill="fill">
    <el-space size="large">
      <Icon width="25" icon="mi:options-vertical"  color="#32CD32"/>
      <el-text type="primary" style="font-size: 20px">Branches</el-text>
    </el-space>
    <el-input placeholder="tapez quelques chose!" v-model="searchForm">
      <template #prepend>
        <Icon width="20" icon="akar-icons:search"/>
      </template>
    </el-input>
    <el-table :data="filteredGrades"  :border="false" empty-text="aucun niveaux trouvé">
      <el-table-column type="index"  />
      <el-table-column label="Code" prop="code"/>
      <el-table-column label="Nom" prop="name" />
      <el-table-column label="Actions" >
        <template #default="scope">
          <el-space>
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
</template>

<style scoped>

</style>