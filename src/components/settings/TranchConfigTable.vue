<script lang="ts" setup>
import {computed, reactive, ref} from 'vue'
import {Icon} from "@iconify/vue";
// @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';


const props = defineProps<{configs:PaymentAnnualConfigEntity[]}>()
const paginator = reactive({
  totalPage: 0,
  currPage: 1,
  pageSize: 15
})
const searchText = ref("")
const filteredList = computed(() => {
  const result = props.configs?.filter((config: PaymentAnnualConfigEntity) => {
    return Object.keys(config).some((key: string) => String((config as any)[key]).toLowerCase().includes(searchText.value.toLowerCase()))
  })
  paginator.totalPage = Math.ceil(result.length / paginator.pageSize)
  return result?.slice((paginator.currPage - 1) * paginator.pageSize, paginator.currPage * paginator.pageSize)
})

const emits = defineEmits<{
  (e:"openUpdateForm", currConfig:PaymentAnnualConfigEntity):any
  (e:"openDetails", currConfig:PaymentAnnualConfigEntity):any
  (e:"delete", currConfig:PaymentAnnualConfigEntity):any
}>()


</script>

<template>
  <el-space direction="vertical" fill>
    <el-text type="primary" size="large">
      Configuration des tranches
    </el-text>
    <el-input v-model="searchText" style="max-width: 600px ; font-size: 14px; font-family: Candara , sans-serif "
              placeholder="tapez quelques choses">
      <template #prepend>
        <el-icon>
          <Icon icon="carbon:search"/>
        </el-icon>
      </template>
    </el-input>
    <el-table :data="filteredList" border empty-text="Aucune configuration trouvée">
        <el-table-column prop="grade.name" label="Classe" />
        <el-table-column label="Nombre de tranche" prop="trancheCount" />
        <el-table-column label="Actions">
        <template #default="scope">
          <el-space>
            <el-space style="cursor: pointer" @click="emits('openDetails' , scope.row)">
                <Icon type="primary" icon="clarity:eye-line" width="20" height="20" />
                <el-text>voir les details</el-text>
            </el-space>
            <el-button type="primary" @click="emits('openUpdateForm' , scope.row)" size="small">Modifier</el-button>
            <el-button  type="danger" @click="emits('delete' , scope.row)" size="small">Supprimer</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
    <el-row justify="center" style="height: 100px">
      <el-pagination
          @current-change="(value:number)=>paginator.currPage=value"
          :current-page="paginator.currPage"
          background
          layout="prev, pager, next"
          :page-size="paginator.pageSize"
          :page-count="paginator.totalPage"
          :total="paginator.totalPage"
      />
    </el-row>
  </el-space>
</template>

<style scoped>
:deep(.el-table--border th.el-table__cell) {
  background-color: #909399 !important;
  color: #ffffff !important;
}

.el-text {
  font-family: "Arial Black";
}


.el-table {
  background-color: #ffffff;
}

.el-space {
  width: 100%;
  padding-left: 10px;
  background-color: #ffffff;
}

</style>
