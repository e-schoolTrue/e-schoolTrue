<template>
  <div>
    <h3>Informations Médicales</h3>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-form-item label="Groupe sanguin">
          <el-input v-model="formData.bloodGroup" placeholder="Groupe sanguin" />
        </el-form-item>
      </el-col>
      <el-col :span="16">
        <el-form-item label="Allergies">
          <el-input v-model="formData.allergies" placeholder="Allergies" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-form-item label="Conditions médicales particulières">
      <el-input v-model="formData.medicalConditions" type="textarea" :rows="3" placeholder="Conditions médicales" />
    </el-form-item>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom du médecin traitant">
          <el-input v-model="formData.doctorName" placeholder="Nom du médecin" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Téléphone du médecin traitant">
          <el-input v-model="formData.doctorPhone" placeholder="Téléphone du médecin" />
        </el-form-item>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
defineProps(['formData']);
</script>
