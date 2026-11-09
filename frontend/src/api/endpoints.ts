import { api } from './client'
import type { User } from './types'

export const getCsrf = () => api<{ csrf_token: string }>('/auth/csrf')
export const getSession = () =>
  api<User | { authenticated: false }>('/auth/session')
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
