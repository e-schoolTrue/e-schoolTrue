<script setup lang="ts">
// @ts-nocheck

import {Icon} from "@iconify/vue";
import schoolbanner from "@/assets/schoolbanner.png";
import {useRouter} from "vue-router";

const router = useRouter();

const testDB = async()=>{
  await window.backend.testDb()
  console.log("task finished")
}

</script>

<template>
  <div class="login-container">
    <div class="login-left-container">
      <el-text style="font-size: 20px; font-weight: bold; " class="">AUTHENTIFICATION</el-text>
      <el-form  label-width="auto" style="max-width: 600px">
        <el-form-item label="Nom d'utilisateur">
          <el-input type="text" >
            <template #prepend><Icon icon="ph:user" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="Mot de passe">
          <el-input type="password">
            <template #prepend><Icon icon="mdi:password" /></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-row justify="center" style="width:100% ">
            <el-button @click="testDB" size="large" style="width: 400px" type="primary">Se connecter</el-button>
          </el-row>
          <el-row justify="center"  style="width:100% ">
            <el-link @click="router.push({name:'forgot-password'})" type="warning">mot de passe oublié</el-link>
          </el-row>
        </el-form-item>
      </el-form>
    </div>
    <div class="login-right-container">
      <el-image style="width:90%; height:90%; border-radius: 10px;" :src="schoolbanner" :fit="'scale-down'"  />
    </div>
  </div>
</template>
<style scoped>
  .login-container{    display: flex;
    flex-direction:row;
  }
  .login-left-container{
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 60px;
    width: 50%;
    height: 100vh;
    padding: 10px;
  }
  .login-right-container{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 50%;
    height: 100vh;
    padding: 10px;
  }
</style>