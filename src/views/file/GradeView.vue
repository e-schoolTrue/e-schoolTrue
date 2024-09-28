<script setup lang="ts">

import GradeTable from "@/components/grade/grade-table.vue";
import {Icon} from "@iconify/vue";
import GradeForm from "@/components/grade/grade-form.vue";
import {onMounted, ref} from "vue";
import {ElMessageBox, FormInstance} from "element-plus";
import {BranchCommand, GradeCommand} from "#electron/command/settingsCommand.ts";
import {BranchEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {cloneDeep} from "lodash"
import {Loader} from "@/components/util/AppLoader.ts";
import BranchForm from "@/components/grade/branch-form.vue";

const newGradeFormRef = ref()
const updateGradeFormRef = ref()
const newBranchFormRef = ref()
const updateBranchFormRef = ref()
const grades = ref<GradeEntity[]>()


function openUpdateGradeForm(grade:GradeEntity){
  updateGradeFormRef.value.open(grade)
}

function openNewBranchForm(grade:GradeEntity){
  newBranchFormRef.value.open(grade)
}

function openUpdateBranchForm(branch:BranchEntity , grade:GradeEntity){
  updateBranchFormRef.value.open(grade , branch)
}
async function newGrade(formRef:FormInstance , form:GradeCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("ajout du niveaux en cours")
      const newGradeResult = await window.ipcRenderer.invoke("grade:new" , cloneDeep(form))
      if(newGradeResult.success){
        grades.value = newGradeResult.data
        newGradeFormRef.value?.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:newGradeResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function newBranch(formRef:FormInstance , form:BranchCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("ajout de la branche en cours")
      const newGradeResult = await window.ipcRenderer.invoke("branch:new" , cloneDeep(form))
      if(newGradeResult.success){
        grades.value = newGradeResult.data
        newBranchFormRef.value?.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:newGradeResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function updateGrade(formRef:FormInstance , form:GradeCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("mise à jour du niveau en cours")
      const updateGradeResult = await window.ipcRenderer.invoke("grade:update" , cloneDeep(form))
      if(updateGradeResult.success){
        grades.value = updateGradeResult.data
        updateGradeFormRef.value.close()
        formRef.resetFields()
        ElMessage({
          type:"success",
          message:updateGradeResult.message
        })
      }else{
        ElMessage({
          type:"error",
          message:updateGradeResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function updateBranch(formRef:FormInstance , form:GradeCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("mise à jour de la branche en cours")
      const updateGradeResult = await window.ipcRenderer.invoke("branch:update" , cloneDeep(form))
      if(updateGradeResult.success){
        grades.value = updateGradeResult.data
        updateBranchFormRef.value.close()
        formRef.resetFields()
        ElMessage({
          type:"success",
          message:updateGradeResult.message
        })
      }else{
        ElMessage({
          type:"error",
          message:updateGradeResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

function deleteGrade(id:number){
  ElMessageBox.confirm(
      'voulez supprimer ce niveau?',
      "Suppression de niveau",
      {
        confirmButtonText: 'oui',
        cancelButtonText: 'non',
        type: 'warning',
      }
  ).then(async() => {
    Loader.showLoader("Suppression du niveau en cours...")
    const result = await window.ipcRenderer.invoke('grade:delete', id)
    if(result.success){
      ElMessage({
        type: 'success',
        message: result.message,
        duration:6000
      })
      grades.value = result.data
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

function deleteBranch(id:number){
  ElMessageBox.confirm(
      'voulez supprimer cette branche?',
      "Suppression de la branche",
      {
        confirmButtonText: 'oui',
        cancelButtonText: 'non',
        type: 'warning',
      }
  ).then(async() => {
    Loader.showLoader("Suppression de la branche en cours...")
    const result = await window.ipcRenderer.invoke('branch:delete', id)
    if(result.success){
      ElMessage({
        type: 'success',
        message: result.message,
        duration:6000
      })
      grades.value = result.data
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
  Loader.showLoader("chargement des niveaux")
  const result=await window.ipcRenderer.invoke("grade:all")
  if(result.success){
    grades.value = result.data
  }else{
    ElMessage({
      type:"error",
      message:result.data
    })
  }
  setTimeout(()=>{
    Loader.hideLoader()
  } , 500)
})

</script>

<template>
  <grade-form
      form-title="Ajout du niveau"
      ref="newGradeFormRef"
      @submit-action="newGrade"
  />
  <grade-form
      ref="updateGradeFormRef"
      form-title="Modification du niveau"
      @submit-action="updateGrade"
  />
  <branch-form
      ref="newBranchFormRef"
      form-title="Ajout d'une branche"
      @submit-action="newBranch"
  />
  <branch-form
      ref="updateBranchFormRef"
      @submit-action="updateBranch"
      form-title="Modification de la branche"
  />
  <el-space direction="vertical" fill="fill" size="large">
    <el-row justify="center" >
      <el-space size="large">
        <Icon width="25" icon="material-symbols:grade-outline"  color="#32CD32"/>
        <el-text type="primary" style="font-size: 20px">Les Niveaux Scolaire</el-text>
      </el-space>
    </el-row>
    <el-row justify="center">
      <el-button type="primary" @click="newGradeFormRef.open()" style="width: 200px; --el-button-text-color:var(--button-text-color); --el-button-hover-text-color: var(--button-hover-text-color); --el-button-hover-bg-color: var(--button-hover-bg-color)">Ajouter</el-button>
    </el-row>
    <grade-table
        :grades="grades"
        @open-update-form="openUpdateGradeForm"
        @delete-action="deleteGrade"
        @open-nested-new-form="openNewBranchForm"
        @open-nested-update-form="openUpdateBranchForm"
        @delete-nested-action="deleteBranch"
    />
  </el-space>
</template>

<style scoped>
</style>