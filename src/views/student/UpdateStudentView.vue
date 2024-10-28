<script setup lang="ts">
import StudentUpdate from '@/components/student/student-update.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const onUpdateComplete = () => {
  router.push({ name: 'StudentList' });
};
</script>

<template>
  <student-update :studentId="Number($route.params.id)" @update-complete="onUpdateComplete" />
</template>

<style scoped>

</style>
