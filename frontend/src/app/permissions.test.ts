import { describe, expect, it } from 'vitest'
import type { User } from '../api/types'
import { canSeeReport, isManager } from './permissions'

const baseUser: User = {
  id: 1,
  username: '1001',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  is_superuser: false,
  must_change_password: false,
  roles: [],
}

function makeUser(overrides: Partial<User> = {}): User {
  return { ...baseUser, ...overrides }
}

describe('User permissions', () => {
  it.each([
    {
      title: 'Super Admin',
      user: makeUser({ is_superuser: true }),
      manage: true,
      report: true,
    },
    {
      title: 'hrFood',
      user: makeUser({ roles: ['hrFood'] }),
      manage: true,
      report: true,
    },
    {
      title: 'Viewer',
      user: makeUser({ roles: ['Viewer'] }),
      manage: false,
      report: true,
    },
    {
      title: 'ordinary employee',
      user: makeUser(),
      manage: false,
      report: false,
    },
    {
      title: 'unknown role',
      user: makeUser({ roles: ['UnknownRole'] }),
      manage: false,
      report: false,
    },
    {
      title: 'Viewer and hrFood together',
      user: makeUser({ roles: ['Viewer', 'hrFood'] }),
      manage: true,
      report: true,
    },
  ])('$title permissions', ({ user, manage, report }) => {
    expect(isManager(user)).toBe(manage)
    expect(canSeeReport(user)).toBe(report)
  })
})
