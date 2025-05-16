<template>
  <div class="wizard-view-container">
    <el-text type="warning" class="info-text title-warning">
      <slot name="title"></slot>
    </el-text>

    <el-scrollbar class="form-scroll-area">
      <div class="wizard-view-content">
        <slot></slot>
      </div>
    </el-scrollbar>

    <div class="action-buttons">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ce composant sert de base pour toutes les vues du wizard
</script>

<style scoped>
.wizard-view-container {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  overflow: hidden;
  background-color: #f5f7fa;
}

.info-text {
  text-align: center;
  margin-bottom: 15px;
  display: block;
  width: 100%;
  flex-shrink: 0;
}

.title-warning {
  font-family: 'cursive', sans-serif;
  font-size: 1.1em;
}

.form-scroll-area {
  width: 100%;
  max-width: 900px;
  flex: 1;
  min-height: 0;
  margin-bottom: 15px;
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.wizard-view-content {
  padding: 25px;
  box-sizing: border-box;
}

.action-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  max-width: 900px;
  gap: 20px;
  padding: 20px 0;
  background-color: #fff;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

/* Styles communs pour tous les composants qui utilisent ce base */
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
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

@media (max-width: 768px) {
  .wizard-view-container {
    padding: 10px;
  }

  .form-scroll-area {
    margin-bottom: 10px;
  }

  .wizard-view-content {
    padding: 15px;
  }

  .action-buttons {
    padding: 15px 0;
    gap: 15px;
  }
}
</style> 