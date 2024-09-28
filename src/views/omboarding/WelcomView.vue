<script setup lang="ts">
// @ts-nocheck
import {inject} from "vue";
import schoolbanner from "@/assets/schoolbanner.png";
import {useRouter} from "vue-router";

const {activeIndex , updateActiveIndex} = inject('activeIndex')
const router = useRouter()

function goNext(){
  updateActiveIndex(1)
  router.push({name: 'data-location'})
}

</script>

<template>
    <div class="element-alignement">
      <el-space direction="vertical" alignment="center" fill="fill" >
        <el-text style="color: #337ecc; font-weight: bold ; align-self: center">
          Bienvenue à Eschool
        </el-text>
        <el-text>
          Eschool est une solution logicielle destinée à la gestion intégrée des établissements scolaires.
        </el-text>
        <el-text>
          Ce document détaille les spécifications fonctionnelles nécessaires pour le développement et la mise en œuvre de cette application.
        </el-text>
        <el-text>
          L'objectif est de fournir une interface utilisateur intuitive permettant une gestion efficace des données académiques et administratives.
        </el-text>
        <el-image style="width:150px; height:150px; border-radius:10px;" :src="schoolbanner" :fit="'scale-down'"  />
      </el-space>
      <el-button type="primary" @click="goNext" style="width:300px">Commencer</el-button>
    </div>
</template>

<style scoped>
  .el-text{
    font-family: "Arial", Gadget, sans-serif;
  }
  .element-alignement{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
</style>