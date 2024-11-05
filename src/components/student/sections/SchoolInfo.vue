<template>
  <div>
    <h3>Informations Académiques</h3>
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
