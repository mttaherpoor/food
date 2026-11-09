export function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`
}
