import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'

import { api, SESSION_EXPIRED_EVENT } from './client'
import { server } from '../test/server'

describe('API session expiration', () => {
  const onExpired = vi.fn()

  beforeEach(() => {
    onExpired.mockClear()
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
  })

  afterEach(() => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  })

  it('keeps a valid session after 403', async () => {
    let sessionChecks = 0

    server.use(
      http.get('*/api/v1/menus', () =>
        HttpResponse.json({ detail: 'Permission denied' }, { status: 403 })
      ),
      http.get('*/api/v1/auth/session', () => {
        sessionChecks += 1
        return HttpResponse.json({
          id: 1,
          username: '1001',
          must_change_password: false,
          roles: ['Viewer'],
        })
      }),
    )

    await expect(api('/menus')).rejects.toMatchObject({ status: 403 })

    expect(sessionChecks).toBe(1)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('detects an expired session after 403', async () => {
    server.use(
      http.get('*/api/v1/menus', () =>
        HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      ),
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json({ authenticated: false })
      ),
    )

    await expect(api('/menus')).rejects.toMatchObject({ status: 403 })

    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('detects expired authentication after 401', async () => {
    server.use(
      http.get('*/api/v1/menus', () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      ),
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json({ detail: 'Not authenticated' }, { status: 403 })
      ),
    )

    await expect(api('/menus')).rejects.toMatchObject({ status: 401 })

    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('does not expire a session on network errors', async () => {
    let sessionChecks = 0

    server.use(
      http.get('*/api/v1/menus', () => HttpResponse.error()),
      http.get('*/api/v1/auth/session', () => {
        sessionChecks += 1
        return HttpResponse.json({ authenticated: false })
      }),
    )

    await expect(api('/menus')).rejects.toMatchObject({ status: 0 })

    expect(sessionChecks).toBe(0)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent session checks', async () => {
    let sessionChecks = 0

    server.use(
      http.get('*/api/v1/menus', () =>
        HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      ),
      http.get('*/api/v1/foods', () =>
        HttpResponse.json({ detail: 'Forbidden' }, { status: 403 })
      ),
      http.get('*/api/v1/auth/session', async () => {
        sessionChecks += 1
        await delay(80)
        return HttpResponse.json({ authenticated: false })
      }),
    )

    const results = await Promise.allSettled([
      api('/menus'),
      api('/foods'),
    ])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(sessionChecks).toBe(1)
    expect(onExpired).toHaveBeenCalledTimes(1)
  })
})
