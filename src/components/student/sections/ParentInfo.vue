<template>
  <div>
    <h3>Informations sur les parents/tuteurs</h3>
    <el-divider content-position="left">Père/Tuteur</el-divider>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom du père/tuteur">
          <el-input v-model="formData.fatherLastname" placeholder="Nom du père/tuteur" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Prénom du père/tuteur">
          <el-input v-model="formData.fatherFirstname" placeholder="Prénom du père/tuteur" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
    </el-row>

    <el-divider content-position="left">Mère/Tutrice</el-divider>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom de la mère/tutrice">
          <el-input v-model="formData.motherLastname" placeholder="Nom de la mère/tutrice" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Prénom de la mère/tutrice">
          <el-input v-model="formData.motherFirstname" placeholder="Prénom de la mère/tutrice" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-form-item label="Téléphone">
          <el-input v-model="formData.famillyPhone" placeholder="Numéro de Famille" />
        </el-form-item>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
defineProps(['formData']);
</script>
