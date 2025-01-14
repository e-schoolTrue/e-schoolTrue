<template>
  <div>
    <h3>Informations sur l'élève</h3>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom">
          <el-input v-model="formData.lastname" placeholder="Nom de l'élève" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Prénom">
          <el-input v-model="formData.firstname" placeholder="Prénom de l'élève" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-form-item label="Date de naissance">
          <el-date-picker v-model="formData.birthDay" type="date" placeholder="Sélectionnez une date" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="Lieu de naissance">
          <el-input v-model="formData.birthPlace" placeholder="Lieu de naissance" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="Numéro personnel (optionnel)">
          <el-input v-model="formData.personalPhone" placeholder="Numéro de téléphone" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Sexe">
          <el-radio-group v-model="formData.sex">
            <el-radio label="male">Masculin</el-radio>
            <el-radio label="female">Féminin</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Adresse">
          <el-input v-model="formData.address" placeholder="Adresse de l'élève" />
        </el-form-item>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
defineProps(['formData']);
</script>
