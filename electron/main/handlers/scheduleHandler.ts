import { ipcMain } from 'electron';
import { ScheduleService } from '#electron/backend/services/scheduleService';

const scheduleService = new ScheduleService();

// ...existing code...

// Ajouter ce gestionnaire
ipcMain.handle('schedule:getByDate', async (_, { date }) => {
    try {
        console.log('=== Server - Récupération des emplois du temps par date ===', date);
        const result = await scheduleService.getScheduleByDate(date);
        console.log('=== Server - Résultat ===', result.success);
        return result;
    } catch (error) {
        console.error('=== Server - Erreur ===', error);
        return {
            success: false,
            message: "Erreur lors de la récupération des emplois du temps",
            data: null,
            error: error.message
        };
    }
});

// ...existing code...