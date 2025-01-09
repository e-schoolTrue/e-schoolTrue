import { ref, onMounted } from 'vue';

const currency = ref('FCFA');

export function useCurrency() {
  const loadCurrency = async () => {
    try {
      const schoolInfo = await window.ipcRenderer.invoke('school:get');
      if (schoolInfo?.success && schoolInfo.data?.country) {
        // Déterminer la devise en fonction du pays
        const currencyMap: { [key: string]: string } = {
          'MAR': 'MAD',
          'SEN': 'FCFA',
          'CAF': 'FCFA',
          'GIN': 'GNF'
        };
        
        currency.value = currencyMap[schoolInfo.data.country] || 'FCFA';
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la devise:', error);
    }
  };

  onMounted(() => {
    loadCurrency();
  });

  return {
    currency,
    loadCurrency
  };
} 