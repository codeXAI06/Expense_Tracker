export function formatRupees(amount: number) {
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR'
  });
}
