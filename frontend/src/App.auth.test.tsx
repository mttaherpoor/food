import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { http, HttpResponse } from 'msw'

import App from './App'
import { api } from './api/client'
import type { User } from './api/types'
import { server } from './test/server'
import { formatMoney } from './utils/format'

vi.mock('./pages/HistoryPage', () => ({
  default: () => <h1>صفحه سوابق آزمایشی</h1>,
}))

vi.mock('./pages/WeekPage', () => ({
  default: () => <h1>صفحه رزرو آزمایشی</h1>,
}))

vi.mock('./pages/CatalogPage', () => ({
  default: () => <h1>صفحه مدیریت آزمایشی</h1>,
}))

const employee: User = {
  id: 1,
  username: '1001',
  first_name: 'کاربر',
  last_name: 'آزمایشی',
  is_active: true,
  is_superuser: false,
  must_change_password: false,
  roles: [],
}

function renderAt(path: string) {
  window.history.replaceState({}, '', path)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

async function fillLogin() {
  const user = userEvent.setup()

  await user.type(
    screen.getByLabelText('کد پرسنلی'),
    '1001'
  )

  await user.type(
    screen.getByLabelText('رمز عبور'),
    'test-password'
  )

  await user.click(
    screen.getByRole('button', { name: 'ورود' })
  )
}

// Default wallet summary for authenticated navigation tests.
const walletSummaryHandler = http.get(
  '/api/v1/reservations/wallet-summary',
  () => HttpResponse.json({
    month: '1405-08',
    spent_toman: 0,
    reservation_count: 0,
  }),
)

describe('Authentication and routing', () => {
  beforeEach(() => {
    server.use(walletSummaryHandler)
    window.history.replaceState({}, '', '/')
  })

  it('updates wallet spending after reservation mutations without refreshing', async () => {
    let spent = 0
    let walletRequests = 0
    let rejectNextCreate = false

    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json(employee),
      ),
      http.get('*/api/v1/reservations/wallet-summary', () => {
        walletRequests += 1
        return HttpResponse.json({
          month: '1405-08',
          spent_toman: spent,
          reservation_count: spent > 0 ? 1 : 0,
        })
      }),
      http.post('*/api/v1/reservations', () => {
        if (rejectNextCreate) {
          return HttpResponse.json(
            { detail: 'Reservation rejected' },
            { status: 400 },
          )
        }

        spent = 250000
        return HttpResponse.json({ id: 12 }, { status: 201 })
      }),
      http.patch('*/api/v1/reservations/12', () => {
        spent = 190000
        return HttpResponse.json({ id: 12 })
      }),
      http.post('*/api/v1/reservations/12/cancel', () => {
        spent = 0
        return HttpResponse.json({ id: 12, status: 'can' })
      }),
    )

    renderAt('/history')

    await screen.findByRole(
      'heading',
      { name: 'صفحه سوابق آزمایشی' },
      { timeout: 5000 },
    )

    const topbar = document.querySelector('.mobile-topbar')
    expect(topbar).not.toBeNull()

    const mobileWallet = within(topbar as HTMLElement)

    await waitFor(() => {
      expect(
        mobileWallet.getByText(formatMoney(0)),
      ).toBeInTheDocument()
    })

    expect(walletRequests).toBeGreaterThanOrEqual(1)

    // A successful creation triggers an immediate wallet refresh.
    const requestsBeforeCreate = walletRequests

    await api('/reservations', {
      method: 'POST',
      body: JSON.stringify({ reservations: [] }),
    })

    await waitFor(() => {
      expect(
        mobileWallet.getByText(formatMoney(250000)),
      ).toBeInTheDocument()
    })

    expect(walletRequests).toBeGreaterThan(requestsBeforeCreate)

    // Editing replaces the previous amount, rather than adding to it.
    await api('/reservations/12', {
      method: 'PATCH',
      body: JSON.stringify({ food_quantity: 1 }),
    })

    await waitFor(() => {
      expect(
        mobileWallet.getByText(formatMoney(190000)),
      ).toBeInTheDocument()
    })

    // Cancellation removes the active reservation's amount.
    await api('/reservations/12/cancel', {
      method: 'POST',
      body: '{}',
    })

    await waitFor(() => {
      expect(
        mobileWallet.getByText(formatMoney(0)),
      ).toBeInTheDocument()
    })

    // A failed mutation must not dispatch a wallet refresh.
    rejectNextCreate = true
    const requestsBeforeFailure = walletRequests

    await expect(
      api('/reservations', {
        method: 'POST',
        body: JSON.stringify({ reservations: [] }),
      }),
    ).rejects.toMatchObject({ status: 400 })

    expect(walletRequests).toBe(requestsBeforeFailure)
    expect(
      mobileWallet.getByText(formatMoney(0)),
    ).toBeInTheDocument()
  })

  it('returns to /history after successful login', async () => {
    server.use(
      http.post('*/api/v1/auth/login', async ({ request }) => {
        const body = await request.json() as {
          username: string
          password: string
        }

        expect(body.username).toBe('1001')
        expect(body.password).toBe('test-password')

        return HttpResponse.json(employee)
      })
    )

    renderAt('/history')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
      expect(
        new URLSearchParams(window.location.search).get('next')
      ).toBe('/history')
    })

    await screen.findByRole('heading', {
      name: 'ورود به حساب',
    })

    await fillLogin()

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/history')
    })
  })

  it('shows the API error and stays on login', async () => {
    renderAt('/history')

    await screen.findByRole('heading', {
      name: 'ورود به حساب',
    })

    await fillLogin()

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('نام کاربری یا رمز عبور اشتباه است.')

    expect(window.location.pathname).toBe('/login')
    expect(
      new URLSearchParams(window.location.search).get('next')
    ).toBe('/history')
  })

  it('denies catalog access to Viewer', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json({
          ...employee,
          roles: ['Viewer'],
        })
      )
    )

    renderAt('/catalog')

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه رزرو آزمایشی',
      })
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/reservations')
  })

  it('keeps the user signed in when logout fails and allows retry', async () => {
    const user = userEvent.setup()
    let logoutAttempts = 0

    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json(employee)
      ),
      http.post('*/api/v1/auth/logout', () => {
        logoutAttempts += 1

        if (logoutAttempts === 1) {
          return HttpResponse.json(
            { detail: 'خطای موقت سرور' },
            { status: 500 }
          )
        }

        return new HttpResponse(null, { status: 204 })
      })
    )

    renderAt('/history')

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    await user.click(
      screen.getAllByRole('button', {
        name: 'خروج از حساب',
      })[0]
    )

    expect(
      await screen.findByRole('alert')
    ).toHaveTextContent('خروج از حساب انجام نشد.')

    expect(window.location.pathname).toBe('/history')
    expect(logoutAttempts).toBe(1)

    await user.click(
      screen.getAllByRole('button', {
        name: 'خروج از حساب',
      })[0]
    )

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })

    expect(logoutAttempts).toBe(2)

    expect(
      await screen.findByRole('heading', {
        name: 'ورود به حساب',
      })
    ).toBeInTheDocument()
  })

  it('logs out and redirects to login', async () => {
    const user = userEvent.setup()
    let authenticated = true

    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json(
          authenticated ? employee : { authenticated: false }
        )
      ),
      http.post('*/api/v1/auth/logout', () => {
        authenticated = false
        return new HttpResponse(null, { status: 204 })
      })
    )

    renderAt('/history')

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    await user.click(
      screen.getAllByRole('button', {
        name: 'خروج از حساب',
      })[0]
    )

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
      expect(
        new URLSearchParams(window.location.search).get('next')
      ).toBe('/history')
    })

    expect(
      await screen.findByRole('heading', {
        name: 'ورود به حساب',
      })
    ).toBeInTheDocument()
  })

  it('requires password change before opening history', async () => {
    const user = userEvent.setup()
    const passwordRequests: unknown[] = []

    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json({
          ...employee,
          must_change_password: true,
        })
      ),
      http.post(
        '*/api/v1/auth/change-password',
        async ({ request }) => {
          passwordRequests.push(await request.json())
          return HttpResponse.json({
            ...employee,
            must_change_password: false,
          })
        }
      )
    )

    renderAt('/history')

    expect(
      await screen.findByRole('heading', {
        name: 'یک رمز تازه انتخاب کن',
      })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText('رمز فعلی'),
      'old-password'
    )
    await user.type(
      screen.getByLabelText('رمز جدید'),
      'new-password-123'
    )
    await user.type(
      screen.getByLabelText('تکرار رمز جدید'),
      'new-password-123'
    )

    await user.click(
      screen.getByRole('button', {
        name: 'ذخیرهٔ رمز جدید',
      })
    )

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    expect(passwordRequests).toEqual([{
      old_password: 'old-password',
      new_password: 'new-password-123',
      new_password_confirm: 'new-password-123',
    }])

    expect(window.location.pathname).toBe('/history')
  })

  it('redirects to login when an active session expires', async () => {
    let sessionValid = true

    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json(
          sessionValid ? employee : { authenticated: false }
        )
      ),
      http.get('*/api/v1/menus', () =>
        HttpResponse.json(
          { detail: 'Authentication required' },
          { status: 403 }
        )
      ),
    )

    renderAt('/history')

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    sessionValid = false

    await expect(api('/menus')).rejects.toMatchObject({
      status: 403,
    })

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
      expect(
        new URLSearchParams(window.location.search).get('next')
      ).toBe('/history')
    })

    expect(
      await screen.findByRole('heading', {
        name: 'ورود به حساب',
      })
    ).toBeInTheDocument()
  })

  it('opens history directly with an authenticated session', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () =>
        HttpResponse.json(employee)
      )
    )

    renderAt('/history')

    expect(
      await screen.findByRole('heading', {
        name: 'صفحه سوابق آزمایشی',
      })
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/history')
  })
})
