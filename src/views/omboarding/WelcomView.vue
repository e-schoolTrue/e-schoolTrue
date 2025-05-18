<script setup lang="ts">
// @ts-nocheck
import { defineEmits } from "vue";
import { useRouter } from "vue-router";
import schoolbanner from "@/assets/schoolbanner.png";
import WizardViewBase from './WizardViewBase.vue';

const router = useRouter();
const emit = defineEmits(['configuration-saved']);

function goNext() {
  console.log('goNext called, emitting configuration-saved event');
  emit('configuration-saved', {});
}

</script>

<template>
  <wizard-view-base>
    <template #title>
      Bienvenue à eSchool
    </template>

    <div class="welcome-content">
      <el-space direction="vertical" alignment="center" fill="fill">
        <el-text>
          eSchool est une solution logicielle destinée à la gestion intégrée des établissements scolaires.
        </el-text>
        <el-text>
          Ce document détaille les spécifications fonctionnelles nécessaires pour le développement et la mise en œuvre de cette application.
        </el-text>
        <el-text>
          L'objectif est de fournir une interface utilisateur intuitive permettant une gestion efficace des données académiques et administratives.
        </el-text>
        <el-image 
          style="width:150px; height:150px; border-radius:10px;" 
          :src="schoolbanner" 
          :fit="'scale-down'" 
        />
      </el-space>
    </div>

    <template #actions>
      <el-button 
        type="primary" 
        @click="goNext" 
        class="action-button">
        Commencer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.welcome-content {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 20px;
}

.el-text {
  font-family: "Arial", Gadget, sans-serif;
  text-align: center;
  line-height: 1.6;
  color: #606266;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
}

.action-button {
  min-width: 200px;
}
</style>