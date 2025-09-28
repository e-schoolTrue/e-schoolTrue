import { ref, onMounted } from 'vue';
import { formatCurrency as formatCurrencyUtil } from '@/components/util/currencyFormatter';

const currency = ref('FCFA');
const currencyCode = ref('XOF'); // Code ISO par défaut

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
        
        // Mapping vers les codes ISO pour les devises qui en ont
        const isoMap: { [key: string]: string } = {
          'MAR': 'MAD',
          'SEN': 'XOF',  // Franc CFA BCEAO
          'CAF': 'XAF',  // Franc CFA BEAC
          'GIN': 'GNF'
        };
        
        currency.value = currencyMap[schoolInfo.data.country] || 'FCFA';
        currencyCode.value = isoMap[schoolInfo.data.country] || 'XOF';
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la devise:', error);
    }
  };

  // Fonction de formatage qui utilise l'utilitaire
  const formatCurrency = (value: number) => {
    return formatCurrencyUtil(value, currency.value);
  };

  onMounted(() => {
    loadCurrency();
  });

  return {
    currency,
    currencyCode,
    loadCurrency,
    formatCurrency
  };
}