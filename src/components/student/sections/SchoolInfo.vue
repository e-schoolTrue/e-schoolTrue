<template>
  <div>
    <h3>Informations Académiques</h3>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Dernière école fréquentée">
          <el-input v-model="formData.lastSchool" placeholder="Nom de la dernière école" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Classe précédente">
          <el-input v-model="formData.lastClass" placeholder="Classe précédente" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-form-item label="Classe">
      <el-select v-model="formData.classId" placeholder="Sélectionnez une classe">
        <el-option
          v-for="classItem in classes"
          :key="classItem.id"
          :label="classItem.name"
          :value="classItem.id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="Année Scolaire">
      <el-input v-model="formData.schoolYear" placeholder="Année scolaire" />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
defineProps(['formData', 'classes']);
</script>
