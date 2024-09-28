<script setup lang="ts">

import {Icon} from "@iconify/vue";
import CourseForm from "@/components/course/course-form.vue";
import CourseTable from "@/components/course/course-table.vue";
import {onMounted, ref} from "vue";
import {CourseEntity} from "#electron/backend/entities/course.ts";
import {ElMessageBox, FormInstance} from "element-plus";
import {CourseCommand} from "#electron/command/settingsCommand.ts";
import {Loader} from "@/components/util/AppLoader.ts";
import {cloneDeep} from "lodash";

const newCourseFormRef = ref()
const updateCourseFormRef = ref()
const courses = ref<CourseEntity[]>([])

function openNewCourseForm(){
  newCourseFormRef.value.open()
}
function openUpdateCourseForm(course:CourseEntity){
  updateCourseFormRef.value.open(course)
}

async function newCourse(formRef:FormInstance , form:CourseCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("ajout de la matière en cours")
      const newCourseResult = await window.ipcRenderer.invoke("course:new" , cloneDeep(form))
      if(newCourseResult.success){
        courses.value = newCourseResult.data
        newCourseFormRef.value?.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:newCourseResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function addCourseToGroupement(formRef:FormInstance , form:CourseCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("ajout de la sous matière en cours")
      const newCourseResult = await window.ipcRenderer.invoke("courseGroup:add" , cloneDeep(form))
      if(newCourseResult.success){
        courses.value = newCourseResult.data
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:newCourseResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

async function updateCourse(formRef:FormInstance , form:CourseCommand){
  if(!formRef) return
  await formRef.validate(async(isValid, invalidFields)=>{
    console.log(invalidFields)
    if(isValid){
      Loader.showLoader("mise à jour de la matière en cours")
      const updateCourseResult = await window.ipcRenderer.invoke("course:update" , cloneDeep(form))
      if(updateCourseResult.success){
        courses.value = updateCourseResult.data
        ElMessage({
          type:"success",
          message:updateCourseResult.message
        })
        updateCourseFormRef.value.close()
        formRef.resetFields()
      }else{
        ElMessage({
          type:"error",
          message:updateCourseResult.message
        })
      }
      setTimeout(()=>{
        Loader.hideLoader()
      } , 500)
    }
  })
}

function deleteCourse(id:number){
  ElMessageBox.confirm(
      'voulez supprimer cette matière?',
      "Suppression de la matière",
      {
        confirmButtonText: 'oui',
        cancelButtonText: 'non',
        type: 'warning',
      }
  ).then(async() => {
    Loader.showLoader("Suppression de la matière en cours...")
    const result = await window.ipcRenderer.invoke('course:delete', id)
    if(result.success){
      ElMessage({
        type: 'success',
        message: result.message,
        duration:6000
      })
      courses.value = result.data
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
  Loader.showLoader()
  const courseResult = await window.ipcRenderer.invoke("course:all")
  if(courseResult.success){
    console.log("courses : ", courseResult.data)
    courses.value = courseResult.data
  }else{
    ElMessage({
      type:"error",
      message:courseResult.message
    })
  }
  Loader.hideLoader()
})

</script>

<template>
  <course-form
      ref="newCourseFormRef"
      form-title="Ajout d'une nouvelle matière"
      @submit-action="newCourse"
  />
  <course-form
      ref="updateCourseFormRef"
      form-title="Modification de la matière"
      @submit-action="updateCourse"
  />
  <el-space direction="vertical" fill="fill" size="large">
    <el-row justify="center" >
      <el-space size="large">
        <Icon width="25" icon="vscode-icons:folder-type-module"  color="#32CD32"/>
        <el-text type="primary" style="font-size: 20px">Table des matières</el-text>
      </el-space>
    </el-row>
    <el-row justify="center">
      <el-button type="primary" @click="openNewCourseForm" style="width: 200px; --el-button-text-color:var(--button-text-color); --el-button-hover-text-color: var(--button-hover-text-color); --el-button-hover-bg-color: var(--button-hover-bg-color)">Ajouter</el-button>
    </el-row>
    <course-table
        :courses="courses"
        @open-update-form="openUpdateCourseForm"
        @delete-action="deleteCourse"
        @add-course-group="addCourseToGroupement"
    />
  </el-space>
</template>

<style scoped>
</style>