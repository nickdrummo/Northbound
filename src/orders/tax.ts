export interface TaxInfo {
  rate: number;
  name: string;
}

const TAX_RATES: Record<string, TaxInfo> = {
  AU: { rate: 0.10, name: 'GST' },
  NZ: { rate: 0.15, name: 'GST' },
  GB: { rate: 0.20, name: 'VAT' },
};

// returns zero-rate fallback for unrecognised or missing country codes
export function getTaxForCountry(countryCode: string): TaxInfo {
  return TAX_RATES[countryCode.toUpperCase()] ?? { rate: 0, name: 'None' };
}
