<script lang="ts" setup>
import { AppItems } from "@/components/util/AppItems.ts";
import { Icon } from "@iconify/vue";
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()
</script>

<template>
  <el-menu
    ellipsis
    mode="horizontal"
    :background-color="themeStore.colors.menuBg"
    :active-text-color="themeStore.colors.menuActiveText"
    :text-color="themeStore.colors.menuText"
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
          <span class="menu-text">{{item.title}}</span>
        </el-space>
      </template>
      
      <template v-for="subItem in item.subItems" :key="subItem.id">
        <!-- Si le sous-menu a des sous-éléments -->
        <el-sub-menu v-if="subItem.subItems && subItem.subItems.length" :index="subItem.id">
          <template #title>
            <el-space>
              <Icon :icon="subItem.icon" />
              <span class="menu-text">{{subItem.title}}</span>
            </el-space>
          </template>
          
          <el-menu-item 
            v-for="childItem in subItem.subItems" 
            :key="childItem.id"
            :index="childItem.route"
          >
            <el-space>
              <Icon :icon="childItem.icon" />
              <span class="menu-text">{{childItem.title}}</span>
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
            <span class="menu-text">{{subItem.title}}</span>
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
  background-color: var(--app-menu-bg-color);
}

:deep(.el-menu--popup .el-menu-item) {
  color: var(--app-menu-text-color);
}

.menu-text {
  color: inherit;
}

:deep(.el-menu--popup .el-menu-item:hover) {
  background-color: var(--app-menu-hover-bg-color);
}
</style>