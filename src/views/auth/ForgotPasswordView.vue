<script setup lang="ts">

import {Icon} from "@iconify/vue";
</script>

<template>
  <div class="validate-account-container">
    <div class="validate-account-box">
      <el-text style="font-size: 20px; font-weight: bold; " class="">MOT DE PASS OUBLIE</el-text>
      <el-form  label-width="auto" style="max-width: 600px">
        <el-form-item label="Nom d'utilisateur">
          <el-input type="text" >
            <template #prepend><Icon icon="ph:user" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="Code">
          <el-input type="text" >
            <template #prepend><Icon icon="material-symbols-light:pin-outline" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="Nouveau mot de passe">
          <el-input type="password">
            <template #prepend><Icon icon="mdi:password" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="Confirmation du mot de passe">
          <el-input type="password">
            <template #prepend><Icon icon="mdi:password" /></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-row justify="center" style="width:100% ">
            <el-button size="large" style="width: 400px" type="primary">Valider</el-button>
          </el-row>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.validate-account-container{
  display: flex;
  flex-direction:column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
}
.validate-account-box{
  display: flex;
  flex-direction:column;
  justify-content: center;
  gap: 60px;
  align-items: center;
  width: 100%;
  height: 100vh;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
}
</style>