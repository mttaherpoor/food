import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { WeeklyMenu } from '../api/types'
import { server } from '../test/server'
import { dateToIso, getWeekStart } from '../utils/date'
import WeekPage from './WeekPage'

const menu: WeeklyMenu = {
  id: 101,
  date: dateToIso(getWeekStart(new Date())),
  food_name: 'غذای آزمایشی',
  food_image: null,
  food_image_data: {
    url: '/static/images/defaults/default-food.webp',
    alt: 'غذای آزمایشی',
  },
  food_price: 100_000,
  reservation: null,
  can_reserve: true,
}

describe('ReservationDialog building selection', () => {
  it('defaults to the employee profile building and sends it in POST', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([menu]),
      ),
      http.get('*/api/v1/sides', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/drinks', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [
            { id: 7, number: '07' },
            { id: 8, number: '08' },
          ],
          departments: [],
        }),
      ),
      http.post('*/api/v1/reservations', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json([], { status: 201 })
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'انتخاب غذا' }),
    )

    const buildingSelect = await screen.findByRole('combobox', {
      name: 'ساختمان محل تحویل',
    })

    await waitFor(() => {
      expect(buildingSelect).toHaveValue('7')
    })

    await user.click(
      screen.getByRole('button', { name: 'ثبت رزرو' }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        reservations: [
          {
            menu: 101,
            building: 7,
            food_quantity: 1,
            sides: [],
            drinks: [],
          },
        ],
      })
    })
  })

  it('allows overriding the profile building without updating the profile', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null
    let profilePatchCount = 0

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([menu]),
      ),
      http.get('*/api/v1/sides', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/drinks', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [
            { id: 7, number: '07' },
            { id: 8, number: '08' },
          ],
          departments: [],
        }),
      ),
      http.patch('*/api/v1/auth/profile', () => {
        profilePatchCount += 1
        return HttpResponse.json({}, { status: 200 })
      }),
      http.post('*/api/v1/reservations', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json([], { status: 201 })
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'انتخاب غذا' }),
    )

    const buildingSelect = await screen.findByRole('combobox', {
      name: 'ساختمان محل تحویل',
    })

    await waitFor(() => {
      expect(buildingSelect).toHaveValue('7')
    })

    await user.selectOptions(buildingSelect, '8')

    expect(buildingSelect).toHaveValue('8')

    await user.click(
      screen.getByRole('button', { name: 'ثبت رزرو' }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        reservations: [
          {
            menu: 101,
            building: 8,
            food_quantity: 1,
            sides: [],
            drinks: [],
          },
        ],
      })
    })

    expect(profilePatchCount).toBe(0)
  })

  it('uses the reservation building instead of the profile and omits unchanged building in PATCH', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    const currentItem = {
      id: 501,
      building: 8,
      side_items: [],
      drink_items: [],
      building_number_snapshot: '08',
      side: null,
      side_name: null,
      drink: null,
      drink_name: null,
      food_price: 100_000,
      side_price: 0,
      drink_price: 0,
      food_quantity: 1,
      side_quantity: 0,
      drink_quantity: 0,
      is_current: true,
      is_cancelled: false,
      total_price: 100_000,
      datetime_created: '2026-11-10T08:00:00Z',
      datetime_modified: '2026-11-10T08:00:00Z',
    }

    const reservedMenu: WeeklyMenu = {
      ...menu,
      reservation: {
        id: 301,
        menu: menu.id,
        menu_date: menu.date,
        food_name: menu.food_name,
        status: 'res',
        current_item: currentItem,
        history: [currentItem],
        total_price: 100_000,
      },
    }

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([reservedMenu]),
      ),
      http.get('*/api/v1/sides', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/drinks', () =>
        HttpResponse.json([]),
      ),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [
            { id: 7, number: '07' },
            { id: 8, number: '08' },
          ],
          departments: [],
        }),
      ),
      http.patch('*/api/v1/reservations/301', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json(reservedMenu.reservation)
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'ویرایش / لغو' }),
    )

    const buildingSelect = await screen.findByRole('combobox', {
      name: 'ساختمان محل تحویل',
    })

    await waitFor(() => {
      expect(buildingSelect).toHaveValue('8')
    })

    await user.click(
      screen.getByRole('button', {
        name: 'افزایش تعداد غذا',
      }),
    )

    expect(
      screen.getByLabelText('تعداد غذای انتخاب‌شده'),
    ).toHaveTextContent('2')

    await user.click(
      screen.getByRole('button', { name: 'ذخیرهٔ ویرایش' }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        food_quantity: 2,
        sides: [],
        drinks: [],
      })
    })
  })

  it('requires a building when restoring a legacy cancelled reservation', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null
    let patchCount = 0

    const historicalItem = {
      id: 601,
      building: null,
      side_items: [],
      drink_items: [],
      building_number_snapshot: null,
      side: null,
      side_name: null,
      drink: null,
      drink_name: null,
      food_price: 100_000,
      side_price: 0,
      drink_price: 0,
      food_quantity: 1,
      side_quantity: 0,
      drink_quantity: 0,
      is_current: true,
      is_cancelled: true,
      total_price: 0,
      datetime_created: '2026-11-10T08:00:00Z',
      datetime_modified: '2026-11-10T08:00:00Z',
    }

    const cancelledMenu: WeeklyMenu = {
      ...menu,
      reservation: {
        id: 401,
        menu: menu.id,
        menu_date: menu.date,
        food_name: menu.food_name,
        status: 'can',
        current_item: historicalItem,
        history: [historicalItem],
        total_price: 0,
      },
    }

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([cancelledMenu]),
      ),
      http.get('*/api/v1/sides', () => HttpResponse.json([])),
      http.get('*/api/v1/drinks', () => HttpResponse.json([])),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [
            { id: 7, number: '07' },
            { id: 8, number: '08' },
          ],
          departments: [],
        }),
      ),
      http.patch('*/api/v1/reservations/401', async ({ request }) => {
        patchCount += 1
        submittedBody = await request.json()
        return HttpResponse.json(cancelledMenu.reservation)
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'رزرو مجدد' }),
    )

    const buildingSelect = await screen.findByRole('combobox', {
      name: 'ساختمان محل تحویل',
    })

    await waitFor(() => {
      expect(buildingSelect).toBeEnabled()
    })

    expect(buildingSelect).toHaveValue('')

    await user.click(
      screen.getByRole('button', { name: 'ثبت رزرو مجدد' }),
    )

    expect(patchCount).toBe(0)

    await user.selectOptions(buildingSelect, '8')

    await user.click(
      screen.getByRole('button', { name: 'ثبت رزرو مجدد' }),
    )

    await waitFor(() => {
      expect(patchCount).toBe(1)
      expect(submittedBody).toEqual({
        building: 8,
        food_quantity: 1,
        sides: [],
        drinks: [],
      })
    })
  })

  it('preserves an inactive historical building when editing another field', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    const currentItem = {
      id: 701,
      building: 8,
      side_items: [],
      drink_items: [],
      building_number_snapshot: '08',
      side: null,
      side_name: null,
      drink: null,
      drink_name: null,
      food_price: 100_000,
      side_price: 0,
      drink_price: 0,
      food_quantity: 1,
      side_quantity: 0,
      drink_quantity: 0,
      is_current: true,
      is_cancelled: false,
      total_price: 100_000,
      datetime_created: '2026-11-10T08:00:00Z',
      datetime_modified: '2026-11-10T08:00:00Z',
    }

    const reservedMenu: WeeklyMenu = {
      ...menu,
      reservation: {
        id: 501,
        menu: menu.id,
        menu_date: menu.date,
        food_name: menu.food_name,
        status: 'res',
        current_item: currentItem,
        history: [currentItem],
        total_price: 100_000,
      },
    }

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([reservedMenu]),
      ),
      http.get('*/api/v1/sides', () => HttpResponse.json([])),
      http.get('*/api/v1/drinks', () => HttpResponse.json([])),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [{ id: 7, number: '07' }],
          departments: [],
        }),
      ),
      http.patch('*/api/v1/reservations/501', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json(reservedMenu.reservation)
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'ویرایش / لغو' }),
    )

    const buildingSelect = await screen.findByRole('combobox', {
      name: 'ساختمان محل تحویل',
    })

    await waitFor(() => {
      expect(buildingSelect).toBeEnabled()
    })

    expect(buildingSelect).toHaveValue('8')
    expect(
      screen.getByRole('option', {
        name: 'ساختمان 08 (ثبت‌شده)',
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'افزایش تعداد غذا',
      }),
    )

    expect(
      screen.getByLabelText('تعداد غذای انتخاب‌شده'),
    ).toHaveTextContent('2')

    await user.click(
      screen.getByRole('button', { name: 'ذخیرهٔ ویرایش' }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        food_quantity: 2,
        sides: [],
        drinks: [],
      })
    })
  })

  it('defaults selected side and drink quantities to one', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    server.use(
      http.get('*/api/v1/reservations/weekly', () =>
        HttpResponse.json([menu]),
      ),
      http.get('*/api/v1/sides', () =>
        HttpResponse.json([{ id: 11, name: 'سالاد', price: 20000 }]),
      ),
      http.get('*/api/v1/drinks', () =>
        HttpResponse.json([{ id: 21, name: 'دوغ', price: 10000 }]),
      ),
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          personnel_number: '1001',
          building: 7,
          building_number: '07',
          department: null,
          department_number: null,
        }),
      ),
      http.get('*/api/v1/auth/profile-options', () =>
        HttpResponse.json({
          buildings: [{ id: 7, number: '07' }],
          departments: [],
        }),
      ),
      http.post('*/api/v1/reservations', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json([], { status: 201 })
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'انتخاب غذا' }),
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'افزودن پیش‌غذا (اختیاری) سالاد',
      }),
    )
    expect(
      screen.getByLabelText('تعداد پیش‌غذا (اختیاری) سالاد'),
    ).toHaveTextContent('1')

    await user.click(
      screen.getByRole('tab', {
        name: /^نوشیدنی/,
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن نوشیدنی (اختیاری) دوغ',
      }),
    )

    expect(
      screen.getByLabelText('تعداد نوشیدنی (اختیاری) دوغ'),
    ).toHaveTextContent('1')

    // Switching tabs must not clear the selected drink.
    await user.click(
      screen.getByRole('tab', {
        name: /^پیش‌غذا/,
      }),
    )

    expect(
      screen.getByLabelText('تعداد پیش‌غذا (اختیاری) سالاد'),
    ).toHaveTextContent('1')

    await user.click(
      screen.getByRole('tab', {
        name: /^نوشیدنی/,
      }),
    )

    expect(
      screen.getByLabelText('تعداد نوشیدنی (اختیاری) دوغ'),
    ).toHaveTextContent('1')

    await user.click(
      screen.getByRole('button', { name: 'ثبت رزرو' }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        reservations: [
          {
            menu: menu.id,
            building: 7,
            food_quantity: 1,
            sides: [{ side: 11, quantity: 1 }],
            drinks: [{ drink: 21, quantity: 1 }],
          },
        ],
      })
    })
  })
})
