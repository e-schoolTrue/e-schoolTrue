<script setup lang="ts">

import {Icon} from "@iconify/vue";
import {onMounted, ref} from "vue";
import {ElMessageBox, FormInstance} from "element-plus";
import {ClassRoomCommand} from "#electron/command/settingsCommand.ts";
import {ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {cloneDeep} from "lodash"
import {Loader} from "@/components/util/AppLoader.ts";
import ClasseRoomForm from "@/components/classroom/classe-room-form.vue";
import ClassRoomTable from "@/components/classroom/class-room-table.vue";

const newClassRoomFormRef = ref()
const updateClassRoomFormRef = ref()
const grades = ref<GradeEntity[]>()
const classRooms =  ref<ClassRoomEntity[]>()

function openUpdateForm(classRoom:ClassRoomEntity){
  updateClassRoomFormRef.value.open(classRoom)
}
async function newClassRoom(formRef:FormInstance|undefined , form:ClassRoomCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("ajout de la salle de classe en cours")
      const newClassRoomResult = await window.ipcRenderer.invoke("classRoom:new" , cloneDeep(form))
      if(newClassRoomResult.success){
        classRooms.value = newClassRoomResult.data
        newClassRoomFormRef.value?.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:newClassRoomResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function updateClassRoom(formRef:FormInstance|undefined , form:ClassRoomCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("mise à jour de salle de classe en cours")
      const updateClassRoomResult = await window.ipcRenderer.invoke("classRoom:update" , cloneDeep(form))
      if(updateClassRoomResult.success){
        classRooms.value = updateClassRoomResult.data
        ElMessage({
          type:"success",
          message:updateClassRoomResult.message
        })
        updateClassRoomFormRef.value.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:updateClassRoomResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

function deleteClassRoom(id:number){
  ElMessageBox.confirm(
      'voulez supprimer cette salle de classe?',
      "Suppression de salle de classe",
      {
        confirmButtonText: 'oui',
        cancelButtonText: 'non',
        type: 'warning',
      }
  ).then(async() => {
    Loader.showLoader("Suppression de la salle de classe en cours...")
    const result = await window.ipcRenderer.invoke('classRoom:delete', id)
    if(result.success){
      ElMessage({
        type: 'success',
        message: result.message,
        duration:6000
      })
      classRooms.value = result.data
    }else{
      ElMessage({
        type: 'error',
        message: result.message,
        duration:6000
      })
    }
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  })
}

onMounted(async()=>{
  Loader.showLoader("chargement des salles de classe")
  const gradesResult =await window.ipcRenderer.invoke("grade:all")
  if(gradesResult.success){
    grades.value = gradesResult.data
  }else{
    ElMessage({
      type:"error",
      message:gradesResult.data
    })
  }
  const classRoomsResult =await window.ipcRenderer.invoke("classRoom:all")
  if(classRoomsResult.success){
    classRooms.value = classRoomsResult.data
  }else{
    ElMessage({
      type:"error",
      message:classRoomsResult.data
    })
  }
  setTimeout(()=>{
    Loader.hideLoader()
  } , 500)
})

</script>

<template>
  <classe-room-form
      ref="newClassRoomFormRef"
      @submit-action="newClassRoom"
      :grades="grades as GradeEntity[] "
  />
  <classe-room-form
      ref="updateClassRoomFormRef"
      @submit-action="updateClassRoom"
      :grades="grades as GradeEntity[]"
  />
  <el-space direction="vertical" fill="fill" size="large">
    <el-row justify="center" >
      <el-space size="large">
        <Icon width="25" icon="material-symbols:grade-outline"  color="#32CD32"/>
        <el-text type="primary" style="font-size: 20px">Les Salles De Classe</el-text>
      </el-space>
    </el-row>
    <el-row justify="center">
      <el-button type="primary" @click="newClassRoomFormRef.open()" style="width: 200px; --el-button-text-color:var(--button-text-color); --el-button-hover-text-color: var(--button-hover-text-color); --el-button-hover-bg-color: var(--button-hover-bg-color)">Ajouter</el-button>
    </el-row>
    <class-room-table
        :class-rooms="classRooms as ClassRoomEntity[]"
        @open-update-form="openUpdateForm"
        @delete-action="deleteClassRoom"
    />
  </el-space>
</template>

<style scoped>
</style>