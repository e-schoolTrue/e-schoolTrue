<script setup lang="ts">
import {provide, ref} from "vue";

const activeIndex = ref('0')
function updateActiveIndex(value:string) {
  activeIndex.value=value;
}

provide("activeIndex" , {
  activeIndex,
  updateActiveIndex
})

</script>

<template>
    <el-space direction="vertical" fill="fill" style="width: 100%">
      <el-card body-class="card-body" style="background-color:#dfdfdf; color: #fff; flex-grow: 1 ">
        <el-steps direction="horizontal" :active="activeIndex" align-center process-status="process" finish-status="success" >
          <el-step title="Bienvenue" />
          <el-step title="Localisation des données" />
          <el-step title="Langue et saisie" />
          <el-step title="Informations générales" />
          <el-step title="Informations du superviseur" />
        </el-steps>
      </el-card>
       <RouterView/>
    </el-space>
</template>

<style scoped>
.el-step{
    color: #003366;
}
.card-body{
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  background-color: #003366;
}
</style>