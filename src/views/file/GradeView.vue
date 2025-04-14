<script setup lang="ts">

import GradeTable from "@/components/grade/grade-table.vue";
import {Icon} from "@iconify/vue";
import GradeForm from "@/components/grade/grade-form.vue";
import {onMounted, ref} from "vue";
import {ElMessage, ElMessageBox, FormInstance} from "element-plus";
import {GradeCommand} from "#electron/command/settingsCommand.ts";
import {BranchEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {cloneDeep} from "lodash"
import {Loader} from "@/components/util/AppLoader.ts";
import BranchForm from "@/components/grade/branch-form.vue";

const newGradeFormRef = ref()
const updateGradeFormRef = ref()
const newBranchFormRef = ref()
const updateBranchFormRef = ref()
const grades = ref<GradeEntity[]>([])
const isLoading = ref(false)

function openUpdateGradeForm(grade:GradeEntity){
  updateGradeFormRef.value.open(grade)
}

function openNewBranchForm(grade:GradeEntity){
  newBranchFormRef.value.open(grade)
}

function openUpdateBranchForm(branch:BranchEntity , grade:GradeEntity){
  updateBranchFormRef.value.open(grade , branch)
}

async function newGrade(formRef:FormInstance|undefined , form:GradeCommand){
  if(!formRef) return
  
  try {
    await formRef.validate(async(isValid, invalidFields)=>{
      console.log(invalidFields)
      if(isValid){
        isLoading.value = true
        Loader.showLoader("Ajout du niveau en cours")
        const newGradeResult = await window.ipcRenderer.invoke("grade:new" , cloneDeep(form))
        if(newGradeResult.success){
          grades.value = newGradeResult.data
          newGradeFormRef.value?.close()
          formRef.resetFields()
          ElMessage.success("Niveau ajouté avec succès")
        }else{
          throw new Error(newGradeResult.message || "Échec de l'ajout du niveau")
        }
      }
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
    console.error("Erreur lors de l'ajout du niveau:", error)
  } finally {
    isLoading.value = false
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  }
}

async function newBranch(formRef:FormInstance|undefined , form:BranchEntity){
  if(!formRef) return
  
  try {
    await formRef.validate(async(isValid, invalidFields)=>{
      console.log(invalidFields)
      if(isValid){
        isLoading.value = true
        Loader.showLoader("Ajout de la branche en cours")
        const newBranchResult = await window.ipcRenderer.invoke("branch:new" , cloneDeep(form))
        if(newBranchResult.success){
          grades.value = newBranchResult.data
          newBranchFormRef.value?.close()
          formRef.resetFields()
          ElMessage.success("Branche ajoutée avec succès")
        }else{
          throw new Error(newBranchResult.message || "Échec de l'ajout de la branche")
        }
      }
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
    console.error("Erreur lors de l'ajout de la branche:", error)
  } finally {
    isLoading.value = false
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  }
}

async function updateGrade(formRef:FormInstance|undefined , form:GradeCommand){
  if(!formRef) return
  
  try {
    await formRef.validate(async(isValid, invalidFields)=>{
      console.log(invalidFields)
      if(isValid){
        isLoading.value = true
        Loader.showLoader("Mise à jour du niveau en cours")
        const updateGradeResult = await window.ipcRenderer.invoke("grade:update" , cloneDeep(form))
        if(updateGradeResult.success){
          grades.value = updateGradeResult.data
          updateGradeFormRef.value.close()
          formRef.resetFields()
          ElMessage.success("Niveau mis à jour avec succès")
        }else{
          throw new Error(updateGradeResult.message || "Échec de la mise à jour du niveau")
        }
      }
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
    console.error("Erreur lors de la mise à jour du niveau:", error)
  } finally {
    isLoading.value = false
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  }
}

async function updateBranch(formRef:FormInstance|undefined , form:BranchEntity){
  if(!formRef) return
  
  try {
    await formRef.validate(async(isValid, invalidFields)=>{
      console.log(invalidFields)
      if(isValid){
        isLoading.value = true
        Loader.showLoader("Mise à jour de la branche en cours")
        const updateBranchResult = await window.ipcRenderer.invoke("branch:update" , cloneDeep(form))
        if(updateBranchResult.success){
          grades.value = updateBranchResult.data
          updateBranchFormRef.value.close()
          formRef.resetFields()
          ElMessage.success("Branche mise à jour avec succès")
        }else{
          throw new Error(updateBranchResult.message || "Échec de la mise à jour de la branche")
        }
      }
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
    console.error("Erreur lors de la mise à jour de la branche:", error)
  } finally {
    isLoading.value = false
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  }
}

function deleteGrade(id:number){
  ElMessageBox.confirm(
      'Voulez-vous supprimer ce niveau?',
      "Suppression de niveau",
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning',
      }
  ).then(async() => {
    try {
      isLoading.value = true
      Loader.showLoader("Suppression du niveau en cours...")
      const result = await window.ipcRenderer.invoke('grade:delete', id)
      if(result.success){
        ElMessage.success(result.message || "Niveau supprimé avec succès")
        grades.value = result.data
      }else{
        throw new Error(result.message || "Échec de la suppression du niveau")
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
      console.error("Erreur lors de la suppression du niveau:", error)
    } finally {
      isLoading.value = false
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  }).catch(() => {
    // L'utilisateur a annulé l'opération
  })
}

function deleteBranch(id:number){
  ElMessageBox.confirm(
      'Voulez-vous supprimer cette branche?',
      "Suppression de la branche",
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning',
      }
  ).then(async() => {
    try {
      isLoading.value = true
      Loader.showLoader("Suppression de la branche en cours...")
      const result = await window.ipcRenderer.invoke('branch:delete', id)
      if(result.success){
        ElMessage.success(result.message || "Branche supprimée avec succès")
        grades.value = result.data
      }else{
        throw new Error(result.message || "Échec de la suppression de la branche")
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
      console.error("Erreur lors de la suppression de la branche:", error)
    } finally {
      isLoading.value = false
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  }).catch(() => {
    // L'utilisateur a annulé l'opération
  })
}

onMounted(async()=>{
  try {
    isLoading.value = true
    Loader.showLoader("Chargement des niveaux")
    const result=await window.ipcRenderer.invoke("grade:all")
    if(result.success){
      grades.value = result.data
    }else{
      throw new Error(result.message || "Échec du chargement des niveaux")
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue")
    console.error("Erreur lors du chargement des niveaux:", error)
  } finally {
    isLoading.value = false
    setTimeout(()=>{
      Loader.hideLoader()
    } , 500)
  }
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
      <el-button type="primary" @click="newGradeFormRef.open()" style="width: 200px; --el-button-text-color:var(--button-text-color); --el-button-hover-text-color: var(--button-hover-text-color); --el-button-hover-bg-color: var(--button-hover-bg-color)" :loading="isLoading">Ajouter</el-button>
    </el-row>
    <grade-table
        :grades="grades || []"
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