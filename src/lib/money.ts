/**
 * Money is always an integer number of paise. Never a float, never a string,
 * never a client-supplied total. Formatting happens only at the edge.
 */

export function rupees(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const paise = abs % 100;
  const grouped = groupIndian(whole);
  return paise === 0 ? `${sign}₹${grouped}` : `${sign}₹${grouped}.${String(paise).padStart(2, '0')}`;
}

/** 250000 -> "2,50,000", the Indian grouping, not the western one. */
export function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

export function toMinor(rupeeAmount: number): number {
  return Math.round(rupeeAmount * 100);
}

/**
 * Prices in the database are tax inclusive, which is what an Indian customer
 * expects to see on a shelf. This splits the tax back out for the invoice.
 */
export function splitInclusiveTax(totalMinor: number, taxPercent: number) {
  const base = Math.round((totalMinor * 100) / (100 + taxPercent));
  return { baseMinor: base, taxMinor: totalMinor - base };
}
