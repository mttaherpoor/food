import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { CatalogItem } from '../../api/types'
import CatalogMultiSelect from './CatalogMultiSelect'
import type { CatalogQuantities } from './CatalogMultiSelect'

const items: CatalogItem[] = [
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

function Harness({
  initial = {},
  disabled = false,
}: {
  initial?: CatalogQuantities
  disabled?: boolean
}) {
  const [quantities, setQuantities] =
    useState<CatalogQuantities>(initial)

  return (
    <>
      <CatalogMultiSelect
        label="پیش‌غذا"
        items={items}
        quantities={quantities}
        onChange={setQuantities}
        disabled={disabled}
      />
      <output data-testid="selection-state">
        {JSON.stringify(quantities)}
      </output>
    </>
  )
}

describe('CatalogMultiSelect', () => {
  it('allows selecting multiple products independently', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا سالاد',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا سالاد',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا ماست و موسیر',
      }),
    )

    expect(
      JSON.parse(
        screen.getByTestId('selection-state').textContent ?? '{}',
      ),
    ).toEqual({
      11: 2,
      12: 1,
    })

    expect(
      screen.getByLabelText('تعداد پیش‌غذا سالاد'),
    ).toHaveTextContent('2')

    expect(
      screen.getByLabelText('تعداد پیش‌غذا ماست و موسیر'),
    ).toHaveTextContent('1')
  })

  it('removes a product when its quantity reaches zero', async () => {
    const user = userEvent.setup()

    render(<Harness initial={{ 11: 1, 12: 2 }} />)

    await user.click(
      screen.getByRole('button', {
        name: 'کاهش پیش‌غذا سالاد',
      }),
    )

    expect(
      JSON.parse(
        screen.getByTestId('selection-state').textContent ?? '{}',
      ),
    ).toEqual({ 12: 2 })

    expect(
      screen.getByRole('button', {
        name: 'کاهش پیش‌غذا سالاد',
      }),
    ).toBeDisabled()
  })

  it('respects the maximum quantity and disabled state', async () => {
    const user = userEvent.setup()

    const view = render(<Harness initial={{ 11: 99 }} />)

    expect(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا سالاد',
      }),
    ).toBeDisabled()

    view.rerender(
      <Harness initial={{ 11: 99 }} disabled />,
    )

    expect(
      screen.getByRole('button', {
        name: 'کاهش پیش‌غذا سالاد',
      }),
    ).toBeDisabled()

    expect(
      screen.getByRole('button', {
        name: 'افزودن پیش‌غذا ماست و موسیر',
      }),
    ).toBeDisabled()

    // No additional interactions should change the state.
    expect(
      JSON.parse(
        screen.getByTestId('selection-state').textContent ?? '{}',
      ),
    ).toEqual({ 11: 99 })

    await user.tab()
  })

  it('renders product images with accessible alt text', () => {
    render(<Harness />)

    expect(
      screen.getByRole('img', { name: 'سالاد' }),
    ).toHaveAttribute(
      'src',
      '/static/images/defaults/default-side.webp',
    )

    expect(
      screen.getByRole('img', { name: 'ماست و موسیر' }),
    ).toBeInTheDocument()
  })
})
