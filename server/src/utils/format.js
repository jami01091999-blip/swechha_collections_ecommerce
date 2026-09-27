/** ₹1,23,456 — same format as the client's formatINR. */
export const formatINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
