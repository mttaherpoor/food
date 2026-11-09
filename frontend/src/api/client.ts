import axios from 'axios'

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

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')

  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    headers.set('X-CSRFToken', csrfCookie())
  }

  try {
    const response = await apiClient.request<T>({
      url: path,
      method,
      headers: Object.fromEntries(headers.entries()),
      data: init.body ?? undefined,
      signal: init.signal ?? undefined,
    })

    if (response.status === 204) {
      return undefined as T
    }

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new ApiError(
        error.response.status,
        error.response.data ?? null,
      )
    }

    if (axios.isCancel(error)) {
      throw error
    }

    if (axios.isAxiosError(error)) {
      throw new ApiError(
        0,
        'اتصال به سرور برقرار نشد. وضعیت اینترنت را بررسی کنید.',
      )
    }

    throw error
  }
}
