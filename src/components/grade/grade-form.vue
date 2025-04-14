<script lang="ts" setup>
import {reactive, ref} from 'vue'
import {GradeCommand} from "#electron/command/settingsCommand.ts";
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";
import {GradeEntity} from "#electron/backend/entities/grade.ts";

const props = defineProps<{formTitle:string}>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<GradeCommand>({
  name:"",
  code:""
})

const formRule = reactive<FormRules<GradeCommand>>({
  code:[
    {required:true, message:"Le code est requis", trigger:"blur"},
    {min: 2, max: 10, message: "Le code doit contenir entre 2 et 10 caractères", trigger: "blur"}
  ],
  name:[
    {required:true, message:"Le nom est requis", trigger:"blur"},
    {min: 3, max: 50, message: "Le nom doit contenir entre 3 et 50 caractères", trigger: "blur"}
  ]
})

function open(grade?:GradeEntity){
  dialogVisible.value = true
  if (grade) {
    form.id = grade.id
    form.name = grade.name || ""
    form.code = grade.code || ""
  } else {
    form.id = undefined
    form.name = ""
    form.code = ""
  }
}

function close(){
  dialogVisible.value = false
  formRef.value?.resetFields()
}

const emits = defineEmits<{
  (e:"submit-action", formRef:FormInstance|undefined, form:GradeCommand):void
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
        <el-input v-model="form.code" placeholder="Ex: 6A, 5B, etc." />
      </el-form-item>
      <el-form-item label="Nom" prop="name">
        <el-input v-model="form.name" placeholder="Ex: Sixième A, Cinquième B, etc." />
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