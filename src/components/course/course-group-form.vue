<script lang="ts" setup>
import {reactive, ref} from 'vue'
import {CourseCommand} from "@/types/course";
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";
import {Course} from "@/types/course";
import {cloneDeep} from "lodash";

const props = defineProps<{formTitle:string}>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<CourseCommand>({
  name:"",
  code:"",
  isInGroupement:true
})
const formRule = reactive<FormRules<CourseCommand>>({
  code:[
    {required:true , message:"ce champ est requis" , trigger:"blur"},
  ],
  name:[
    {required:true , message:"ce champ est requis" , trigger:"blur"}
  ],
  coefficient:[
    {required:true , message:"ce champ est requis" , trigger:"blur"},
    {validator :(rule:any, value:any, callback:any)=>{
      if(value>10){
        throw("le coefficient ne peut depasser 10"+String(rule));
      }else{
        callback()
      }
    }, trigger:"blur"}
  ],
})
function open(groupement:Course,  course?:CourseCommand){
  dialogVisible.value = true
  
  // Réinitialiser le formulaire
  form.name = "";
  form.code = "";
  form.coefficient = 1;
  form.isInGroupement = true;
  
  // Définir le groupement (matière parente)
  form.groupement = cloneDeep({
    id: groupement.id,
    name: groupement.name,
    code: groupement.code,
    coefficient: groupement.coefficient,
    isInGroupement: groupement.isInGroupement
  });
  
  // Si un cours est fourni, utiliser ses données (pour modifier une sous-matière existante)
  if(course){
    form.name = course.name || "";
    form.code = course.code || "";
    form.coefficient = course.coefficient || 1;
  }
}
function close(){
  dialogVisible.value = false
}
const emits = defineEmits<{
  (e:"submit-action" , formRef:FormInstance|undefined , form:CourseCommand):void
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
      <el-form-item label="Coefficient" prop="coefficient">
        <el-input v-model="form.coefficient" type="number" />
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