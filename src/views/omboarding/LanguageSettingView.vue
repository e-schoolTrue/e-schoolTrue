<script setup lang="ts">
// @ts-nocheck
import {inject} from "vue";
import {useRouter} from "vue-router";

const {activeIndex, updateActiveIndex} = inject('activeIndex')
const router = useRouter()

function goNext(){
  updateActiveIndex(3)
  router.push({name: 'general-info'})
}

function goBback(){
  updateActiveIndex(2)
  router.push({name: 'data-location'})
}

</script>

<template>
  <div class="element-alignement">
    <el-space direction="vertical">
      <el-text type="warning" style="font-family: Candara , sans-serif ; ">Veillez renseigner les paramètres de connexion</el-text>
      <el-space direction="horizontal" style="margin-bottom: 20px">
        <el-form >
          <el-form-item label="Code  de l'établissement">
            <el-input placeholder="Code  de l'établissement" style="width: 300px" />
          </el-form-item>
          <el-form-item label="Zône d'inspection">
            <el-input placeholder="Zône d'inspection" style="width: 300px" />
          </el-form-item>
          <el-form-item label="Code  de departement">
            <el-input placeholder="Code  de departement" style="width: 300px" />
          </el-form-item>
        </el-form>
      </el-space>
    </el-space>
    <div style="">
      <el-space direction="horizontal">
        <el-button type="primary" @click="goNext" style="width:300px">Continuer</el-button>
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