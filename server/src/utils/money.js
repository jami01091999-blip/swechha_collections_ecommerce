/** Rupees, rounded to whole rupees (all shop prices are whole rupees). */
export const rupees = (n) => Math.round(Number(n) || 0);
/** Two-decimal rounding for tax figures on invoices. */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const toPaise = (n) => Math.round((Number(n) || 0) * 100);
