import type { User } from '../api/types'

export function isManager(user: User) {
  return user.is_superuser || user.roles.includes('hrFood')
}

export function canSeeReport(user: User) {
  return isManager(user) || user.roles.includes('Viewer')
}
