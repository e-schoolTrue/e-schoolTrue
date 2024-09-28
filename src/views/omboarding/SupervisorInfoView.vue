<script setup lang="ts">
// @ts-nocheck
import {inject} from "vue";
import {useRouter} from "vue-router";

const {activeIndex, updateActiveIndex} = inject('activeIndex')
const router = useRouter()

function goNext(){
  router.push({name: 'home'})
}

function goBback(){
  updateActiveIndex(3)
  router.push({name: 'general-info'})
}

</script>

<template>
  <div class="element-alignement">
    <el-space direction="vertical">
      <el-text type="warning" style="font-family: Candara , sans-serif ; ">Veillez renseigner les informations de connexion du superviseur</el-text>
      <el-space direction="horizontal" style="margin-bottom: 20px">
        <el-form >
          <el-form-item label="nom utilisateur">
            <el-input placeholder="nom utilisateur" style="width: 300px" />
          </el-form-item>
          <el-form-item label="mot de passe">
            <el-input placeholder="mot de passe" style="width: 300px" />
          </el-form-item>
          <el-form-item label="confirmation de mot de passe">
            <el-input placeholder="confirmation de mot de passe" style="width: 300px" />
          </el-form-item>
        </el-form>
      </el-space>
    </el-space>
    <div style="">
      <el-space direction="horizontal">
        <el-button type="primary" @click="goNext" style="width:300px">Valider</el-button>
        <el-button type="info" @click="goBback"  style="width:300px">Retourner</el-button>
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