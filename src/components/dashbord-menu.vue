
<script lang="ts" setup>
import {AppItems} from "@/components/util/AppItems.ts";
import {Icon} from "@iconify/vue";
</script>

<template>
  <el-menu
      ellipsis
      mode="horizontal"
      background-color="#003366"
      active-text-color="#ff4500"
      text-color="#fff"
      :popper-offset="0"
      router
  >
    <el-menu-item index="1">Processing Center</el-menu-item>
    <el-sub-menu v-for="item in AppItems" :index="item.id">
      <template #title>
        <el-space>
          <Icon :icon="item.icon"/>
          <el-text type="success">{{item.title}}</el-text>
        </el-space>
      </template>
      <el-menu-item v-for="subItem in item.subItems" :index="subItem.route">
        <el-space>
          <Icon :icon="subItem.icon" />
          <el-text type="success" >{{subItem.title}}</el-text>
        </el-space>
      </el-menu-item>
    </el-sub-menu>

    <el-menu-item index="4" disabled>Info</el-menu-item>
    <el-menu-item index="5">Orders</el-menu-item>
  </el-menu>
</template>

<style scoped>

</style>