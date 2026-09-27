<script lang="ts" setup>
import { computed } from 'vue'
import { AppItems } from "@/components/util/AppItems.ts";
import { filterMenu } from '@/utils/rbac'
import { Icon } from "@iconify/vue";
import { useThemeStore } from '@/stores/themeStore'
import { useUserStore } from '@/stores/userStore'
import { useYearStore } from '@/stores/yearStore'
import UserMenu from '@/components/layout/UserMenu.vue'

const themeStore = useThemeStore()
const userStore = useUserStore()
const yearStore = useYearStore()

/**
 * Année de session — affichage LECTURE SEULE dans la barre menus.
 * Règle produit : AUCUN sélecteur d'année en cours de session.
 * Le header affiche `yearStore.activeYear` en readonly (el-tag, sans
 * dropdown, sans @change, sans appel `setActiveYear`).
 * `setActiveYear` réservé à `LoginView` (choix initial) et
 * `YearRepartitionView` admin (gouvernance). Les autres écrans consomment
 * silencieusement `yearStore.activeYear`.
 */

/** Libellé readonly : ex. "2026-2027" + " (en cours)" / " — clôturée" en texte. */
const activeYearLabel = computed(() => {
  const y = yearStore.activeYear
  if (!y) return ''
  return `${y.schoolYear}${y.isCurrent ? ' (en cours)' : ''}${y.status === 'closed' ? ' — clôturée' : ''}`
})

// Filtrage menu : single source `filterMenu` de `@/utils/rbac`
// (même fonction utilisée par les tests — pas de copie locale).
// Intention : sans `roles` = visible tout authentifié (y c. comptable),
// voir l'en-tête de `src/utils/rbac.ts`. Backend deny-by-default garde-fou.

const filteredItems = computed(() => filterMenu(AppItems, (...r) => userStore.hasRole(...r)))
</script>

<template>
  <div class="dashboard-navbar">
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
      class="dashboard-el-menu"
    >
    <el-menu-item index="/">Dashboard</el-menu-item>
    <el-sub-menu v-for="item in filteredItems" :key="item.id" :index="item.id">
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
    <div class="user-menu-wrapper">
      <el-tag
        v-if="activeYearLabel"
        type="info"
        effect="plain"
        class="year-readonly"
        aria-label="Année scolaire active"
        title="Année scolaire active (lecture seule)"
      >
        {{ activeYearLabel }}
      </el-tag>
      <UserMenu />
    </div>
  </div>
</template>

<style scoped>
.dashboard-navbar {
  display: flex;
  align-items: stretch;
  width: 100%;
  background-color: v-bind('themeStore.colors.menuBg');
}

.dashboard-el-menu {
  flex: 1;
  border-bottom: none;
}

.user-menu-wrapper {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 8px;
  flex-shrink: 0;
}
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

.year-readonly {
  flex-shrink: 0;
  cursor: default;
  user-select: none;
}

:deep(.el-menu--popup .el-menu-item:hover) {
  background-color: var(--app-menu-hover-bg-color);
}
</style>