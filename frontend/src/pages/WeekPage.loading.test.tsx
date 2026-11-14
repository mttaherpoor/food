import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { WeeklyMenu } from '../api/types'
import { server } from '../test/server'
import { addDays, dateToIso, getWeekStart } from '../utils/date'
import WeekPage from './WeekPage'

const weekStart = getWeekStart(new Date())
const firstWeek = dateToIso(weekStart)
const secondWeek = dateToIso(addDays(weekStart, 7))
const thirdWeek = dateToIso(addDays(weekStart, 14))

function makeMenu(date: string, name: string): WeeklyMenu {
  return {
    id: 101,
    date,
    food_name: name,
    food_price: 100_000,
    food_image: null,
    food_image_data: {
      url: '/static/images/defaults/default-food.webp',
      alt: name,
    },
    reservation: null,
    can_reserve: true,
  }
}

function mockEmptyCatalog() {
  server.use(
    http.get('*/api/v1/sides', () => HttpResponse.json([])),
    http.get('*/api/v1/drinks', () => HttpResponse.json([])),
  )
}

describe('WeekPage loading and request safety', () => {
  it('ignores an outdated weekly response after navigating forward twice', async () => {
    const user = userEvent.setup()

    let releaseSecondWeek: (() => void) | undefined

    const secondWeekResponse = new Promise<void>((resolve) => {
      releaseSecondWeek = resolve
    })

    mockEmptyCatalog()

    server.use(
      http.get('*/api/v1/reservations/weekly', async ({ request }) => {
        const url = new URL(request.url)
        const start = url.searchParams.get('start')

        if (start === firstWeek) {
          return HttpResponse.json([
            makeMenu(firstWeek, 'غذای هفته اول آزمایشی'),
          ])
        }

        if (start === secondWeek) {
          await secondWeekResponse

          return HttpResponse.json([
            makeMenu(secondWeek, 'غذای هفته دوم آزمایشی'),
          ])
        }

        if (start === thirdWeek) {
          return HttpResponse.json([
            makeMenu(thirdWeek, 'غذای هفته سوم آزمایشی'),
          ])
        }

        return HttpResponse.json([])
      }),
    )

    render(<WeekPage />)

    expect(
      await screen.findByText('غذای هفته اول آزمایشی'),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'هفتهٔ بعد' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('status', {
          name: 'در حال بارگذاری برنامه هفتگی',
        }),
      ).toBeInTheDocument()
    })

    await user.click(
      screen.getByRole('button', { name: 'هفتهٔ بعد' }),
    )

    expect(
      await screen.findByText('غذای هفته سوم آزمایشی'),
    ).toBeInTheDocument()

    // Now deliver the older, slower response.
    await act(async () => {
      releaseSecondWeek?.()
      await secondWeekResponse
    })

    // The most recently requested week must remain visible.
    expect(
      screen.getByText('غذای هفته سوم آزمایشی'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('غذای هفته دوم آزمایشی'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('status', {
        name: 'در حال بارگذاری برنامه هفتگی',
      }),
    ).not.toBeInTheDocument()
  })

  it('ends loading and shows an error when the weekly API fails', async () => {
    mockEmptyCatalog()

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json(
          { detail: 'خطای آزمایشی دریافت برنامه' },
          { status: 503 },
        ),
      ),
    )

    render(<WeekPage />)

    expect(
      screen.getByRole('status', {
        name: 'در حال بارگذاری برنامه هفتگی',
      }),
    ).toBeInTheDocument()

    expect(
      await screen.findByText(/خطای آزمایشی دریافت برنامه/),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.queryByRole('status', {
          name: 'در حال بارگذاری برنامه هفتگی',
        }),
      ).not.toBeInTheDocument()
    })
  })

  it('ignores an old refresh response after switching weeks', async () => {
    const user = userEvent.setup()
    let requestCount = 0
    let releaseRefresh: (() => void) | undefined
    let notifyRefreshStarted: (() => void) | undefined

    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })

    const refreshStarted = new Promise<void>((resolve) => {
      notifyRefreshStarted = resolve
    })

    mockEmptyCatalog()

    server.use(
      http.get('*/api/v1/reservations/weekly', async ({ request }) => {
        const start = new URL(request.url).searchParams.get('start')

        if (start === firstWeek) {
          requestCount += 1

          if (requestCount > 1) {
            notifyRefreshStarted?.()
            await refreshGate
          }

          return HttpResponse.json([
            makeMenu(firstWeek, 'غذای هفته اول'),
          ])
        }

        if (start === secondWeek) {
          return HttpResponse.json([
            makeMenu(secondWeek, 'غذای هفته دوم'),
          ])
        }

        return HttpResponse.json([])
      }),
    )

    render(<WeekPage />)

    expect(
      await screen.findByText('غذای هفته اول'),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'تازه‌سازی برنامه هفتگی',
      }),
    )

    await refreshStarted

    await user.click(
      screen.getByRole('button', { name: 'هفتهٔ بعد' }),
    )

    expect(
      await screen.findByText('غذای هفته دوم'),
    ).toBeInTheDocument()

    await act(async () => {
      releaseRefresh?.()
      await refreshGate
    })

    expect(
      screen.getByText('غذای هفته دوم'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('غذای هفته اول'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('status', {
        name: 'در حال بارگذاری برنامه هفتگی',
      }),
    ).not.toBeInTheDocument()
  })
})
