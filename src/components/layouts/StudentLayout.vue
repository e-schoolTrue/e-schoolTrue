<!-- StudentLayout.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

// Computed property pour déterminer l'item actif du menu
const activeMenuItem = computed(() => {
  switch (route.name) {
    case 'StudentList':
      return '1';
    case 'UpdateStudent':
      return '2';
    case 'StudentDetails':
      return '3';
    case 'PaymentManagement':
      return '4';
      case 'AbsenceManagement':
      return '5';
    default:
      return '1';
  }
});

// Computed pour gérer l'état disabled des boutons
const canShowEdit = computed(() => {
  return ['UpdateStudent', 'StudentDetails'].includes(route.name as string);
});

const canShowDetails = computed(() => {
  return ['StudentDetails', 'UpdateStudent'].includes(route.name as string);
});
</script>

<template>
  <el-container>
    <!-- Barre latérale de navigation -->
    <el-aside width="250px">
      <el-card shadow="hover">
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold; color: #ff4500;">
            Gestion des Élèves
          </el-text>
        </el-row>
        <el-menu :default-active="activeMenuItem">
          <el-menu-item index="1" @click="() => router.push({ name: 'StudentList' })">
            Liste des Élèves
          </el-menu-item>
          <el-menu-item 
            index="2" 
            :disabled="!canShowEdit"
            @click="() => router.push({ name: 'UpdateStudent', params: { id: route.params.id } })"
          >
            Modifier
          </el-menu-item>
          <el-menu-item 
            index="3" 
            :disabled="!canShowDetails"
            @click="() => router.push({ name: 'StudentDetails', params: { id: route.params.id } })"
          >
            Détail
          </el-menu-item>
          <el-menu-item 
            index="4"
            @click="() => router.push({ name: 'PaymentManagement' })"
          >
            Paiement
          </el-menu-item>
          <el-menu-item 
            index="5"
            @click="() => router.push({ name: 'AbsenceManagement' })"
          >
            Absence
          </el-menu-item>
        </el-menu>
      </el-card>
    </el-aside>

    <!-- Contenu principal -->
    <el-main>
      <el-card shadow="always" class="main-card">
        <router-view></router-view>
      </el-card>
    </el-main>
  </el-container>
</template>

<style scoped>
.el-container {
  height: calc(100vh - 60px);
}

.el-aside {
  background-color: #003366;
  padding: 10px;
}

.el-main {
  padding: 5px;
}

.main-card {
  border-radius: 4px;
  background-color: #fff;
  height: 100%;
}
</style>
