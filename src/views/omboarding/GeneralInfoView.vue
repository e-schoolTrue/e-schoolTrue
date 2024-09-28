<script setup lang="ts">
// @ts-nocheck
import {inject, ref} from "vue";
import {useRouter} from "vue-router";
import {schoolNatures, schoolTypes, studentTypes} from "@/datas/selectOptions.ts";
import {UploadProps} from "element-plus";
import { Plus } from '@element-plus/icons-vue'

const {activeIndex , updateActiveIndex} = inject('activeIndex')
const router = useRouter()

function goNext(){
  updateActiveIndex(4)
  router.push({name: 'supervisor-info'})
}

function goBack(){
  updateActiveIndex(2)
  router.push({name: 'language-setting'})

}

const imageUrl = ref('')

const handleAvatarSuccess: UploadProps['onSuccess'] = (
    response,
    uploadFile
) => {
  imageUrl.value = URL.createObjectURL(uploadFile.raw!)
}

const beforeAvatarUpload: UploadProps['beforeUpload'] = (rawFile) => {
  if (rawFile.type !== 'image/jpeg') {
    ElMessage.error('Avatar picture must be JPG format!')
  } else if (rawFile.size / 1024 / 1024 > 2) {
    ElMessage.error('Avatar picture size can not exceed 2MB!')
  }
  return true
}
</script>

<template>
  <div class="element-alignement">
    <el-space direction="vertical">
      <el-text type="warning" style="font-family: 'cursive', sans-serif">veillez fournir les information à propos de votre école</el-text>
      <el-text style="font-family: 'Arial Black', sans-serif">Infos generales</el-text>
      <el-row>
        <el-col>
          <el-space >
            <el-scrollbar max-height="350px">
              <el-card  shadow="hover" >
                <el-form size="large" style="width: 350px">
                  <el-form-item label="Type d'établissement">
                    <el-select
                        placeholder="Type d'établissement"
                        clearable
                    >
                      <el-option v-for="schoolType in schoolTypes" :label="schoolType.label" :value="schoolType.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="Nature">
                    <el-select
                        placeholder="Nature"
                        clearable
                    >
                      <el-option v-for="schoolType in schoolNatures" :label="schoolType.label" :value="schoolType.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="Type d'élèves">
                    <el-select
                        placeholder="Type d'élèves"
                        clearable
                    >
                      <el-option v-for="schoolType in studentTypes" :label="schoolType.label" :value="schoolType.value" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="Nom de l'établissement">
                    <el-input placeholder="Nom de l'établissement"/>
                  </el-form-item>
                  <el-form-item label="Adresse">
                    <el-input placeholder="Adresse"/>
                  </el-form-item>
                  <el-form-item label="Ville">
                    <el-input placeholder="Ville"/>
                  </el-form-item>
                  <el-form-item label="Telephone">
                    <el-input placeholder="Telephone"/>
                  </el-form-item>
                  <el-form-item label="Email">
                    <el-input placeholder="Email"/>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-scrollbar>
            <el-card shadow="hover">
             <el-space direction="vertical">
               <el-text style="font-family: 'Arial Black', sans-serif">Logo de l'établissement</el-text>
               <el-upload
                   class="avatar-uploader"
                   :show-file-list="false"
                   :on-success="handleAvatarSuccess"
                   :before-upload="beforeAvatarUpload"
               >
                 <img v-if="imageUrl" :src="imageUrl" class="avatar"  alt="shcool icon"/>
                 <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
               </el-upload>
             </el-space>
            </el-card>
          </el-space>
        </el-col>
        <el-col>
        </el-col>
      </el-row>
      <el-row>
      </el-row>
    </el-space>
    <el-space alignment="center">
      <el-button style="width: 320px" type="primary" @click="goNext" >Continuer</el-button>
      <el-button style="width: 320px" type="info" @click="goBack">Retourner</el-button>
    </el-space>
  </div>
</template>


<style scoped>
.element-alignement{
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-uploader .avatar {
  width: 178px;
  height: 178px;
  display: block;
}
</style>

<style>
.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.el-icon.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  text-align: center;
}
</style>