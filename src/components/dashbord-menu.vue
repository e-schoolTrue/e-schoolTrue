<script lang="ts" setup>
import { AppItems } from "@/components/util/AppItems.ts";
import { Icon } from "@iconify/vue";
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
    :default-active="$route.path"
    trigger="hover"
  >
    <el-menu-item index="/">Dashboard</el-menu-item>
    <el-sub-menu v-for="item in AppItems" :key="item.id" :index="item.id">
      <template #title>
        <el-space>
          <Icon :icon="item.icon"/>
          <el-text type="success">{{item.title}}</el-text>
        </el-space>
      </template>
      
      <template v-for="subItem in item.subItems" :key="subItem.id">
        <!-- Si le sous-menu a des sous-éléments -->
        <el-sub-menu v-if="subItem.subItems && subItem.subItems.length" :index="subItem.id">
          <template #title>
            <el-space>
              <Icon :icon="subItem.icon" />
              <el-text type="success">{{subItem.title}}</el-text>
            </el-space>
          </template>
          
          <el-menu-item 
            v-for="childItem in subItem.subItems" 
            :key="childItem.id"
            :index="childItem.route"
          >
            <el-space>
              <Icon :icon="childItem.icon" />
              <el-text type="success">{{childItem.title}}</el-text>
            </el-space>
          </el-menu-item>
        </el-sub-menu>
        
        <!-- Si le sous-menu n'a pas de sous-éléments -->
        <el-menu-item 
          v-else 
          :index="subItem.route"
        >
          <el-space>
            <Icon :icon="subItem.icon" />
            <el-text type="success">{{subItem.title}}</el-text>
          </el-space>
        </el-menu-item>
      </template>
    </el-sub-menu>
  </el-menu>
</template>

<style scoped>
:deep(.el-sub-menu__title) {
  padding: 0 20px;
}

:deep(.el-menu--horizontal > .el-sub-menu .el-sub-menu__title) {
  height: 60px;
  line-height: 60px;
}

:deep(.el-menu--popup) {
  min-width: 200px;
  background-color: #003366;
}

:deep(.el-menu--popup .el-menu-item) {
  color: #fff;
}

:deep(.el-menu--popup .el-menu-item:hover) {
  background-color: #004080;
}
</style>