export function dayInZone(date = new Date(), timeZone = 'Asia/Dubai') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export const healthDay = () => dayInZone(new Date(), 'Asia/Dubai');
export function daysBefore(day, n) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}
