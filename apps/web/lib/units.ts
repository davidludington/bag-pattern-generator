export function cmToMm(cm: number): number {
  return Math.round(cm * 10 * 1000) / 1000;
}

export function mmToCm(mm: number): number {
  return Math.round((mm / 10) * 100) / 100;
}

export function formatMm(value: number): string {
  if (Number.isInteger(value)) return String(value);
  // thicknesses like 0.75 mm need two decimals; sizes need one
  return Math.abs(value) < 10 ? String(Math.round(value * 100) / 100) : value.toFixed(1);
}
