<!-- src/views/components/MessageCustomizer.vue -->
<template>
    <el-form-item label="Message personnalisé">
      <el-input 
        v-model="message" 
        type="textarea" 
        :rows="4"
        placeholder="Rédigez votre message..."
        @input="emitMessageUpdate"
      >
        <template #prepend>
          <el-button @click="insertPlaceholder('firstname')">
            + Prénom
          </el-button>
          <el-button @click="insertPlaceholder('lastname')">
            + Nom
          </el-button>
        </template>
      </el-input>
  
      <div class="message-preview mt-2">
        <strong>Aperçu :</strong> 
        {{ messagePreview }}
      </div>
    </el-form-item>
  </template>
  
  <script setup lang="ts">
  import { ref, defineEmits } from 'vue'
  
  const emit = defineEmits(['message-updated'])
  
  const message = ref('')
  const messagePreview = ref('')
  
  const insertPlaceholder = (type: 'firstname' | 'lastname') => {
    const placeholder = `{${type}}`
    message.value += message.value ? ` ${placeholder}` : placeholder
    emitMessageUpdate()
  }
  
  const emitMessageUpdate = () => {
    emit('message-updated', message.value)
    
    // Simple preview generation
    messagePreview.value = message.value
      .replace('{firstname}', 'Jean')
      .replace('{lastname}', 'Dupont')
  }
  </script>