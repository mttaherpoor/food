import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/api/v1/auth/session', () =>
    HttpResponse.json({ authenticated: false })
  ),

  http.get('*/api/v1/auth/csrf', () =>
    HttpResponse.json({ csrf_token: 'test-csrf-token' })
  ),

  http.post('*/api/v1/auth/login', () =>
    HttpResponse.json(
      { detail: 'نام کاربری یا رمز عبور اشتباه است.' },
      { status: 401 }
    )
  ),

  http.post('*/api/v1/auth/logout', () =>
    new HttpResponse(null, { status: 204 })
  ),
]
