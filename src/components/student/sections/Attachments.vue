<template>
  <div>
    <h3>Pièces Jointes</h3>
    <el-form-item label="Photo de l'élève">
      <el-upload
        class="avatar-uploader"
        action="#"
        :show-file-list="false"
        :on-change="handleAvatarChange"
        :before-upload="beforeAvatarUpload"
        :auto-upload="false"
      >
        <img v-if="imageUrl" :src="imageUrl" class="avatar" />
        <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
      </el-upload>
    </el-form-item>
    <el-form-item label="Documents">
      <el-upload
        class="upload-demo"
        action="#"
        :on-change="handleDocumentChange"
        :on-remove="handleRemove"
        :before-remove="beforeRemove"
        multiple
        :limit="5"
        :on-exceed="handleExceed"
        :auto-upload="false"
      >
        <el-button type="primary">Cliquez pour uploader</el-button>
        <template #tip>
          <div class="el-upload__tip">
            Acte de naissance, justificatif de domicile, carnet de santé, certificat de radiation, relevés de notes
          </div>
        </template>
      </el-upload>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import type { UploadProps, UploadUserFile } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps(['formData']);

const imageUrl = ref('');

const handleAvatarChange: UploadProps['onChange'] = (uploadFile) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    imageUrl.value = e.target?.result as string;
    if (props.formData) {
      props.formData.photo = {
        name: uploadFile.name,
        type: uploadFile.raw?.type,
        size: uploadFile.size,
        content: e.target?.result as string
      };
    }
  };
  reader.readAsDataURL(uploadFile.raw!);
};

const handleDocumentChange: UploadProps['onChange'] = (uploadFile) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    if (props.formData) {
      if (!props.formData.document) props.formData.document = [];
      props.formData.document.push({
        name: uploadFile.name,
        type: uploadFile.raw?.type,
        size: uploadFile.size,
        content: e.target?.result as string
      });
    }
  };
  reader.readAsDataURL(uploadFile.raw!);
};

const beforeAvatarUpload: UploadProps['beforeUpload'] = (rawFile) => {
  if (rawFile.type !== 'image/jpeg' && rawFile.type !== 'image/png') {
    ElMessage.error('La photo doit être au format JPG ou PNG!')
    return false
  } else if (rawFile.size / 1024 / 1024 > 2) {
    ElMessage.error('La taille de la photo ne doit pas dépasser 2MB!')
    return false
  }
  return true
};

const handleRemove = (file: UploadUserFile) => {
  if (props.formData && props.formData.document) {
    const index = props.formData.document.findIndex((doc: any) => doc.name === file.name);
    if (index !== -1) {
      props.formData.document.splice(index, 1);
    }
  }
};

const handleExceed: UploadProps['onExceed'] = (files) => {
  ElMessage.warning(
    `La limite est de 5 fichiers, vous avez sélectionné ${files.length} fichiers cette fois, pour un total de ${files.length + 5}`
  )
};

const beforeRemove: UploadProps['beforeRemove'] = (uploadFile) => {
  return ElMessageBox.confirm(
    `Annuler le transfert de ${uploadFile.name} ?`
  ).then(
    () => true,
    () => false
  )
};
</script>

<style scoped>
.avatar-uploader .avatar {
  width: 178px;
  height: 178px;
  display: block;
}
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
