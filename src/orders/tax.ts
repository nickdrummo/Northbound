export interface TaxInfo {
  rate: number;
  name: string;
}

const TAX_RATES: Record<string, TaxInfo> = {
  AU: { rate: 0.10,  name: 'GST' },
  NZ: { rate: 0.15,  name: 'GST' },
  CA: { rate: 0.05,  name: 'GST' },
  IN: { rate: 0.18,  name: 'GST' },
  SG: { rate: 0.09,  name: 'GST' },
  GB: { rate: 0.20,  name: 'VAT' },
  DE: { rate: 0.19,  name: 'VAT' },
  FR: { rate: 0.20,  name: 'VAT' },
  NL: { rate: 0.21,  name: 'VAT' },
  SE: { rate: 0.25,  name: 'VAT' },
  NO: { rate: 0.25,  name: 'VAT' },
  DK: { rate: 0.25,  name: 'VAT' },
  CH: { rate: 0.081, name: 'VAT' },
  IT: { rate: 0.22,  name: 'VAT' },
  ES: { rate: 0.21,  name: 'VAT' },
  MX: { rate: 0.16,  name: 'VAT' },
  ZA: { rate: 0.15,  name: 'VAT' },
  KR: { rate: 0.10,  name: 'VAT' },
  AE: { rate: 0.05,  name: 'VAT' },
  CN: { rate: 0.13,  name: 'VAT' },
  JP: { rate: 0.10,  name: 'CT'  },
};

// returns zero-rate fallback for unrecognised or missing country codes
export function getTaxForCountry(countryCode: string): TaxInfo {
  return TAX_RATES[countryCode.toUpperCase()] ?? { rate: 0, name: 'None' };
}
