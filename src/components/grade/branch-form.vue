<script lang="ts" setup>
import {reactive, ref} from 'vue'
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";
import {BranchEntity, GradeEntity} from "#electron/backend/entities/grade.ts";

const props = defineProps<{formTitle:string}>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<BranchEntity>({
  name:"",
  code:"",
  grade: undefined
})

const formRule = reactive<FormRules<BranchEntity>>({
  code:[
    {required:true, message:"Le code est requis", trigger:"blur"},
    {min: 2, max: 10, message: "Le code doit contenir entre 2 et 10 caractères", trigger: "blur"}
  ],
  name:[
    {required:true, message:"Le nom est requis", trigger:"blur"},
    {min: 3, max: 50, message: "Le nom doit contenir entre 3 et 50 caractères", trigger: "blur"}
  ]
})

function open(grade:GradeEntity, branch?:BranchEntity){
  dialogVisible.value = true
  if (branch) {
    form.id = branch.id
    form.name = branch.name || ""
    form.code = branch.code || ""
  } else {
    form.id = undefined
    form.name = ""
    form.code = ""
  }
  form.grade = grade
}

function close(){
  dialogVisible.value = false
  formRef.value?.resetFields()
}

const emits = defineEmits<{
  (e:"submit-action", formRef:FormInstance|undefined, form:BranchEntity):void
}>()

defineExpose({
  open,
  close
})
</script>

<template>
  <el-dialog 
    v-model="dialogVisible" 
    width="500px"
    :close-on-click-modal="false"
    :destroy-on-close="true"
  >
    <template #header>
      <el-space direction="horizontal">
        <Icon icon="ei:plus" color="#32CD32" width="20"/>
        <el-text size="large" type="primary">{{ props.formTitle }}</el-text>
      </el-space>
    </template>
    <el-form
      ref="formRef"
      size="default"
      label-position="top"
      :model="form"
      :rules="formRule"
      status-icon
    >
      <el-form-item label="Code" prop="code">
        <el-input v-model="form.code" placeholder="Ex: SCI, LIT, etc." />
      </el-form-item>
      <el-form-item label="Nom" prop="name">
        <el-input v-model="form.name" placeholder="Ex: Scientifique, Littéraire, etc." />
      </el-form-item>
      <el-form-item label="Niveau" v-if="form.grade">
        <el-input v-model="form.grade.name" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="close">Annuler</el-button>
        <el-button type="primary" @click="emits('submit-action', formRef, form)">
          Valider
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>