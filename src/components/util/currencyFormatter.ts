/**
 * Utilitaire pour formater les montants en devise
 * Gère les cas spéciaux comme le FCFA qui n'est pas un code ISO standard
 */

export function formatCurrency(value: number, currency: string = 'FCFA'): string {
  // Gérer les valeurs nulles ou undefined
  if (value == null || isNaN(value)) {
    return '0 ' + currency;
  }

  // Gérer le cas du FCFA qui n'est pas un code ISO standard
  if (currency === 'FCFA') {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    return `${formatted} FCFA`;
  }
  
  // Mapping des devises personnalisées vers les codes ISO
  const currencyMap: { [key: string]: string } = {
    'MAD': 'MAD',  // Dirham marocain
    'GNF': 'GNF',  // Franc guinéen
    'XOF': 'XOF',  // Franc CFA BCEAO
    'XAF': 'XAF'   // Franc CFA BEAC
  };
  
  const isoCode = currencyMap[currency] || 'XOF';
  
  try {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: isoCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  } catch (error) {
    // Fallback si le code de devise n'est pas reconnu
    console.warn(`Devise non reconnue: ${currency}, utilisation du format par défaut`);
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    return `${formatted} ${currency}`;
  }
}

/**
 * Formatte un montant avec le symbole FCFA
 */
export function formatFCFA(value: number): string {
  return formatCurrency(value, 'FCFA');
}

/**
 * Parse un montant formaté pour récupérer la valeur numérique
 */
export function parseCurrency(formattedValue: string): number {
  // Enlever tous les caractères non numériques sauf le point et la virgule
  const cleaned = formattedValue.replace(/[^\d,.-]/g, '');
  // Remplacer la virgule par un point pour la conversion
  const normalized = cleaned.replace(',', '.');
  return parseFloat(normalized) || 0;
}
