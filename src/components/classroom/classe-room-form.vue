<script lang="ts" setup>
import {computed, reactive, ref} from 'vue'
import {ClassRoomCommand} from "#electron/command/settingsCommand.ts";
import {FormInstance, FormRules} from "element-plus";
import {Icon} from "@iconify/vue";
import {ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";

const props = defineProps<{classRoom?:ClassRoomEntity , grades:GradeEntity[]}>()
const dialogVisible = ref(false)
const formTitle = computed(()=>{
  return props.classRoom? "Modification de Salle de Classe":"Ajout de Salle de Classe"
})
const formRef = ref<FormInstance>()
const form = reactive<ClassRoomCommand>({
  name:"",
  code:"",

})
const formRule = reactive<FormRules>({
  code: [
    {required: true, message: "ce champ est requis", trigger: "blur"}
  ],
  name: [
    {required: true, message: "ce champ est requis", trigger: "blur"}
  ],
  capacity: [
    {required: true, message: "ce champ est requis", trigger: "blur"}
  ],
  grade: [
    {required: true, message: "ce champ est requis", trigger: "blur"}
  ]
});
function open(classRoom?:ClassRoomEntity){
  dialogVisible.value = true
  form.name=classRoom?.name || ""
  form.code=classRoom?.code || ""
  form.capacity=classRoom?.capacity || 0
  form.grade=classRoom?.grade || undefined
}
function close(){
  dialogVisible.value = false
}
const emits = defineEmits<{
  (e: "submit-action", formRef: FormInstance | undefined, form: ClassRoomCommand): void
}>();
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
        <el-text size="large" type="primary">{{ formTitle }}</el-text>
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
      <el-form-item label="Capacité" prop="capacity">
        <el-input v-model="form.capacity" type="number" />
      </el-form-item>
      <el-form-item label="Niveau" prop="grade">
        <el-select v-model="form.grade" value-key="id" no-data-text="aucun niveau  trouvé">
          <el-option
              v-for="grade in props.grades"
              :key="grade.id"
              :label="grade.name"
              :value="grade"
          >
              <el-tag type="info">{{grade.name}}</el-tag>
          </el-option>
        </el-select>
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