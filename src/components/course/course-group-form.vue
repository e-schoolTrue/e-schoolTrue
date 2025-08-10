<script lang="ts" setup>
import {reactive, ref} from 'vue'
import {CourseGroupCommand, Course} from "@/types/course";
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";

const props = defineProps<{formTitle:string}>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const form = reactive<CourseGroupCommand>({
  id: undefined,
  name:"",
  code:"",
  coefficient: 1,
  isInGroupement: true,
  groupementId: undefined,
  groupement: undefined
})

const formRule = reactive<FormRules<CourseGroupCommand>>({
  code:[
    {required:true , message:"Ce champ est requis" , trigger:"blur"},
  ],
  name:[
    {required:true , message:"Ce champ est requis" , trigger:"blur"}
  ],
  coefficient:[
    {required:true , message:"Ce champ est requis" , trigger:"change"},
    {type: 'number', message: 'Le coefficient doit être un nombre', trigger: 'change' },
    {validator :(_rule:any, value:any, callback:any)=>{
      const numValue = Number(value);
      if (isNaN(numValue)) {
        callback(new Error("Veuillez entrer un nombre valide."));
      } else if(numValue > 10){
        callback(new Error("Le coefficient ne peut dépasser 10."));
      } else if (numValue <= 0) {
        callback(new Error("Le coefficient doit être supérieur à 0."));
      }
      else{
        callback();
      }
    }, trigger:"change"}
  ],
})

function open(groupementParent: Course, courseToEdit?: CourseGroupCommand){
  dialogVisible.value = true
  
  form.id = undefined;
  form.name = "";
  form.code = "";
  form.coefficient = 1;
  form.isInGroupement = true;
  form.groupementId = groupementParent.id;

  if (groupementParent.id !== undefined) {
    form.groupement = { 
      id: groupementParent.id,
      name: groupementParent.name,
      code: groupementParent.code,
      coefficient: groupementParent.coefficient,
    };
  } else {
    form.groupement = undefined;
  }

  if(courseToEdit){
    form.id = courseToEdit.id;
    form.name = courseToEdit.name || "";
    form.code = courseToEdit.code || "";
    form.coefficient = courseToEdit.coefficient === undefined ? 1 : courseToEdit.coefficient;
    form.isInGroupement = courseToEdit.isInGroupement === undefined ? true : courseToEdit.isInGroupement;
  }
}

function close(){
  formRef.value?.resetFields();
  dialogVisible.value = false
}

const emits = defineEmits<{
  (e:"submit-action" , formRef:FormInstance|undefined , form:CourseGroupCommand):void
}>()

defineExpose({
  open,
  close
})
</script>


<template>
  <el-dialog v-model="dialogVisible" :title="props.formTitle" width="500" @close="close">
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
        @submit.prevent="emits('submit-action' , formRef , form)"
    >
      <el-form-item label="Code de la sous-matière" prop="code">
        <el-input v-model="form.code" placeholder="Ex: MATH-01A" />
      </el-form-item>
      <el-form-item label="Nom de la sous-matière" prop="name">
        <el-input v-model="form.name" placeholder="Ex: Algèbre Linéaire" />
      </el-form-item>
      <el-form-item label="Coefficient de la sous-matière" prop="coefficient">
        <el-input-number v-model="form.coefficient" :min="1" :max="10" controls-position="right" style="width: 100%;" />
      </el-form-item>
      <el-form-item label="Fait partie du groupement">
        <el-input :model-value="form.groupement?.name || 'N/A'" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="close">Annuler</el-button>
        <el-button type="primary" @click="emits('submit-action' , formRef , form)">
          Valider
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>

</style>