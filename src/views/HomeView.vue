<script lang="ts" setup>
// @ts-nocheck

import DashbordMenu from "@/components/dashbord-menu.vue";
</script>

<template>
 <el-space direction="vertical" fill="fill">
   <dashbord-menu/>
   <router-view/>
 </el-space>
</template>

<style scoped>

.el-scrollbar{
  background-color: #f5f5f5;
}

.el-space{
  width: 100%;
}

</style>

