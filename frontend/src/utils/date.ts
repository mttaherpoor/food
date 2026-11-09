export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  }).format(new Date(`${date}T12:00:00`))
}

export function dateToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7))
  return start
}

export function addDays(date: Date, count: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + count)
  return result
}


export function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00`))
}
