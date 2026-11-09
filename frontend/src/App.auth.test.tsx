import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import { http, HttpResponse } from 'msw'

import App from './App'
import type { User } from './api/types'
import { server } from './test/server'

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

describe('Authentication and routing', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
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
