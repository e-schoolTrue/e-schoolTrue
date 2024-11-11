<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  student: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'submit']);

const form = ref({
  date: new Date(),
  reason: '',
  justified: false
});

const rules = {
  date: [{ required: true, message: 'La date est requise' }],
  reason: [{ required: true, message: 'Le motif est requis' }]
};

const handleSubmit = () => {
  emit('submit', { ...form.value });
};

const handleClose = () => {
  emit('update:visible', false);
  form.value = {
    date: new Date(),
    reason: '',
    justified: false
  };
};

const isVisible = computed(() => props.visible);
</script>

<template>
  <el-dialog
    title="Ajouter une absence"
    v-model="isVisible"
    @close="handleClose"
    width="500px"
  >
    <el-form
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="Date" prop="date">
        <el-date-picker
          v-model="form.date"
          type="date"
          placeholder="Sélectionner la date"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="Motif" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          rows="3"
          placeholder="Saisir le motif de l'absence"
        />
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.justified">
          Absence justifiée
        </el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">Annuler</el-button>
      <el-button type="primary" @click="handleSubmit">
        Ajouter
      </el-button>
    </template>
  </el-dialog>
</template>