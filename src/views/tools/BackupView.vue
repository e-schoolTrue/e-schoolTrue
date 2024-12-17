<script setup lang="ts">
import { useBackupStore } from '@/stores/backupStore';
import { storeToRefs } from 'pinia';
import { onMounted } from 'vue';

const backupStore = useBackupStore();
const { history, stats, isBackupInProgress } = storeToRefs(backupStore);

onMounted(async () => {
    try {
        await backupStore.initializeBackupSystem();
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
});
</script> 