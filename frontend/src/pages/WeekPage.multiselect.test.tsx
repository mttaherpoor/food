import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { ReservationItem, WeeklyMenu } from '../api/types'
import { server } from '../test/server'
import { dateToIso, getWeekStart } from '../utils/date'
import WeekPage from './WeekPage'

const menu: WeeklyMenu = {
  id: 101,
  date: dateToIso(getWeekStart(new Date())),
  food_name: 'غذای آزمایشی',
  food_price: 100_000,
  food_image: null,
  food_image_data: {
    url: '/static/images/defaults/default-food.webp',
    alt: 'غذای آزمایشی',
  },
  reservation: null,
  can_reserve: true,
}

const sides = [
  {
    id: 11,
    name: 'سالاد',
    price: 20_000,
    image: null,
    image_data: {
      url: '/static/images/defaults/default-side.webp',
      alt: 'سالاد',
    },
  },
  {
    id: 12,
    name: 'ماست و موسیر',
    price: 15_000,
    image: null,
    image_data: {
      url: '/static/images/defaults/default-side.webp',
      alt: 'ماست و موسیر',
    },
  },
]

const drinks = [
  {
    id: 21,
    name: 'دوغ',
    price: 10_000,
    image: null,
    image_data: {
      url: '/static/images/defaults/default-drink.webp',
      alt: 'دوغ',
    },
  },
  {
    id: 22,
    name: 'آبمیوه',
    price: 25_000,
    image: null,
    image_data: {
      url: '/static/images/defaults/default-drink.webp',
      alt: 'آبمیوه',
    },
  },
]

function mockCatalog(weeklyMenu: WeeklyMenu) {
  server.use(
    http.get('*/api/v1/reservations/weekly', () =>
      HttpResponse.json([weeklyMenu]),
    ),
    http.get('*/api/v1/sides', () => HttpResponse.json(sides)),
    http.get('*/api/v1/drinks', () => HttpResponse.json(drinks)),
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
  )
}

describe('WeekPage multi-selection integration', () => {
  it('submits multiple sides and drinks with independent quantities', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    mockCatalog(menu)

    server.use(
      http.post('*/api/v1/reservations', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json([], { status: 201 })
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', { name: 'انتخاب غذا' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', {
          name: 'ساختمان محل تحویل',
        }),
      ).toHaveValue('7')
    })

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا (اختیاری) سالاد',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'افزایش تعداد پیش‌غذا (اختیاری) سالاد',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا (اختیاری) ماست و موسیر',
      }),
    )

    await user.click(
      screen.getByRole('tab', { name: /^نوشیدنی/ }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن نوشیدنی (اختیاری) دوغ',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'افزودن نوشیدنی (اختیاری) آبمیوه',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'افزایش تعداد نوشیدنی (اختیاری) آبمیوه',
      }),
    )

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
            sides: [
              { side: 11, quantity: 2 },
              { side: 12, quantity: 1 },
            ],
            drinks: [
              { drink: 21, quantity: 1 },
              { drink: 22, quantity: 2 },
            ],
          },
        ],
      })
    })
  })

  it('restores selected items and preserves the existing building on edit', async () => {
    const user = userEvent.setup()
    let submittedBody: unknown = null

    const currentItem: ReservationItem = {
      id: 501,
      building: 8,
      building_number_snapshot: '08',
      side_items: [
        {
          side: 11,
          side_name: 'سالاد',
          quantity: 2,
          unit_price: 20_000,
          total_price: 40_000,
        },
        {
          side: 12,
          side_name: 'ماست و موسیر',
          quantity: 1,
          unit_price: 15_000,
          total_price: 15_000,
        },
      ],
      drink_items: [
        {
          drink: 21,
          drink_name: 'دوغ',
          quantity: 1,
          unit_price: 10_000,
          total_price: 10_000,
        },
      ],
      side: null,
      side_name: null,
      drink: null,
      drink_name: null,
      food_price: 100_000,
      side_price: 55_000,
      drink_price: 10_000,
      food_quantity: 1,
      side_quantity: 3,
      drink_quantity: 1,
      is_current: true,
      is_cancelled: false,
      total_price: 165_000,
      datetime_created: '2026-11-11T08:00:00Z',
      datetime_modified: '2026-11-11T08:00:00Z',
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
        total_price: 165_000,
      },
    }

    mockCatalog(reservedMenu)

    server.use(
      http.patch('*/api/v1/reservations/301', async ({ request }) => {
        submittedBody = await request.json()
        return HttpResponse.json(reservedMenu.reservation)
      }),
    )

    render(<WeekPage />)

    await user.click(
      await screen.findByRole('button', {
        name: 'ویرایش / لغو',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('combobox', {
          name: 'ساختمان محل تحویل',
        }),
      ).toHaveValue('8')
    })

    expect(
      screen.getByLabelText('تعداد پیش‌غذا (اختیاری) سالاد'),
    ).toHaveTextContent('2')

    expect(
      screen.getByLabelText('تعداد پیش‌غذا (اختیاری) ماست و موسیر'),
    ).toHaveTextContent('1')

    // Switch tabs and verify that existing quantities are retained.
    await user.click(
      screen.getByRole('tab', { name: /^نوشیدنی/ }),
    )

    expect(
      screen.getByLabelText('تعداد نوشیدنی (اختیاری) دوغ'),
    ).toHaveTextContent('1')

    await user.click(
      screen.getByRole('tab', { name: /^پیش‌غذا/ }),
    )

    expect(
      screen.getByLabelText('تعداد پیش‌غذا (اختیاری) سالاد'),
    ).toHaveTextContent('2')

    // Remove one side using the dedicated delete button.
    await user.click(
      screen.getByRole('button', {
        name: 'حذف پیش‌غذا (اختیاری) ماست و موسیر',
      }),
    )

    await user.click(
      screen.getByRole('tab', { name: /^نوشیدنی/ }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن نوشیدنی (اختیاری) آبمیوه',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'ذخیرهٔ ویرایش',
      }),
    )

    await waitFor(() => {
      expect(submittedBody).toEqual({
        food_quantity: 1,
        sides: [{ side: 11, quantity: 2 }],
        drinks: [
          { drink: 21, quantity: 1 },
          { drink: 22, quantity: 1 },
        ],
      })
    })
  })
})
