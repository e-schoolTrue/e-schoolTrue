<script lang="ts" setup>
import {reactive, ref} from 'vue'
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";
import {BranchEntity, GradeEntity} from "#electron/backend/entities/grade.ts";

const props = defineProps<{formTitle:string }>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<BranchEntity>({
  name:"",
  code:"",
})
const formRule = reactive<FormRules<BranchEntity>>({
  code:[
    {required:true , message:"ce champ est requis" , trigger:"blur"}
  ],
  name:[
    {required:true , message:"ce champ est requis" , trigger:"blur"}
  ]
})
function open(grade:GradeEntity , branch?:BranchEntity){
  console.log("openned: ", grade)
  dialogVisible.value = true
  form.name=branch?.name || ""
  form.code=branch?.code || ""
  form.grade = grade
}
function close(){
  dialogVisible.value = false
}
const emits = defineEmits<{
  (e:"submit-action" , formRef:FormInstance , form:BranchEntity):void
}>()
defineExpose({
  open,
  close
})

</script>


<template>
  <el-dialog v-model="dialogVisible" width="500">
    <template #header>
      <el-space direction="horizontal">
        <Icon icon="ei:plus" color="#32CD32" width="20"/>
        <el-text size="large" type="primary">{{ props.formTitle }}</el-text>
      </el-space>
    </template>
    <el-form
        ref="formRef"
        size="default"
        label-position="left"
        :model="form"
        :rules="formRule"

    >
      <el-form-item label="Code" prop="code">
        <el-input v-model="form.code" />
      </el-form-item>
      <el-form-item label="Nom" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">Annuler</el-button>
        <el-button type="primary" @click="emits('submit-action' , formRef , form)">
          Valider
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>

</style>