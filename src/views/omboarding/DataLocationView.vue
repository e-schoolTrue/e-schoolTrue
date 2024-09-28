<script setup lang="ts">
// @ts-nocheck
import {inject, ref} from "vue";
import {useRouter} from "vue-router";
import {openErrorNotification} from "@/components/util/AppLoader.ts";

const {activeIndex , updateActiveIndex} = inject('activeIndex')
const router = useRouter()
const selectedPath = ref('')

function goNext(){
  updateActiveIndex(2)
  router.push({name: 'language-setting'})
}

function goBback(){
  updateActiveIndex(1)
  router.push({name: 'welcome'})
}

async function openFileDialog() {
  selectedPath.value = await window.ipcRenderer.invoke('open-file-dialog');
  try {
    await window?.backend.initDb(selectedPath.value)
    window.localStorage.setItem("installation-token", selectedPath.value)
  } catch (e) {
    if(e?.code === "SQLITE_CANTOPEN"){
      openErrorNotification("Erreur lors de la création de la base de données car l'application n'a pas de droit sur le chemin veillez choisir un chemin accessible")
    }
  }
}
</script>

<template>
  <div class="element-alignement">
    <el-space direction="vertical">
      <el-text type="warning" style="font-family: Candara , sans-serif ; ">Veillez renseigner les paramètres de connexion</el-text>
      <el-space direction="horizontal" style="margin-bottom: 20px">
        <el-text  style="font-family: 'Arial Black' , sans-serif ; ">Chemin des données</el-text>
        <el-input v-model="selectedPath" placeholder="Emplacement de la base de données" style="width: 300px" />
        <el-button type="primary" @click="openFileDialog" style="width: 100px">Parcourir</el-button>
      </el-space>
    </el-space>
    <div style="">
      <el-space direction="horizontal">
        <el-button type="primary" @click="goNext" style="width:300px">Continuer</el-button>
        <el-button type="info" @click="goBback" style="width:300px">Retourner</el-button>
      </el-space>
    </div>
  </div>
</template>

<style scoped>
.element-alignement{
  display: flex;
  flex-direction: column;
  align-items: center;
}

</style>