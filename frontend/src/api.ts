export type User = {
  id: number
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  must_change_password: boolean
  roles: string[]
}

export type CatalogItem = { id: number; name: string; price: number }

export type ReservationItem = {
  id: number
  side: number | null
  side_name: string | null
  drink: number | null
  drink_name: string | null
  food_price: number
  side_price: number
  drink_price: number
  food_quantity: number
  side_quantity: number
  drink_quantity: number
  is_current: boolean
  is_cancelled: boolean
  total_price: number
  datetime_created: string
  datetime_modified: string
}

export type Reservation = {
  id: number
  menu: number
  menu_date: string
  food_name: string
  status: 'res' | 'can'
  current_item: ReservationItem | null
  history: ReservationItem[]
  total_price: number
}

export type WeeklyMenu = {
  id: number
  date: string
  food_name: string
  food_price: number
  reservation: Reservation | null
}

export type DailyReport = {
  date: string
  food: string
  reserved_count: number
  cancelled_count: number
  food_quantity: number
  total_toman: number
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, details: unknown) {
    super(readableError(details))
    this.status = status
    this.details = details
  }
}

function readableError(details: unknown): string {
  if (typeof details === 'string') return details
  if (details && typeof details === 'object') {
    const values = Object.values(details as Record<string, unknown>).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    )
    return values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join('، ')
  }
  return 'ارتباط با سرور انجام نشد. دوباره تلاش کنید.'
}

function csrfCookie(): string {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrftoken='))
    ?.split('=')[1] ?? ''
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) headers.set('X-CSRFToken', csrfCookie())

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'اتصال به سرور برقرار نشد. وضعیت اینترنت را بررسی کنید.')
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

export const getCsrf = () => api<{ csrf_token: string }>('/auth/csrf')
export const getSession = () => api<User>('/auth/session')
export const logout = () => api<void>('/auth/logout', { method: 'POST', body: '{}' })

export async function login(username: string, password: string): Promise<User> {
  await getCsrf()
  return api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function changePassword(old_password: string, new_password: string, new_password_confirm: string) {
  return api<User>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password, new_password, new_password_confirm }),
  })
}
