import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import FoodPicker from './FoodPicker'

const foods = [
  {
    id: 1,
    name: 'قورمه سبزی',
    price: 100000,
    container_price: 10000,
    total_price: 110000,
  },
  {
    id: 2,
    name: 'زرشک پلو با مرغ',
    price: 120000,
    container_price: 10000,
    total_price: 130000,
  },
]

describe('FoodPicker', () => {
  it('shows the selected food', () => {
    render(
      <FoodPicker
        foods={foods}
        value="1"
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /قورمه سبزی/ }),
    ).toBeInTheDocument()
  })

  it('disables selection when no foods exist', () => {
    render(
      <FoodPicker
        foods={[]}
        value=""
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /انتخاب غذای روز/ }),
    ).toBeDisabled()
  })

  it('opens the dialog and selects another food', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <FoodPicker
        foods={foods}
        value="1"
        onChange={onChange}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /قورمه سبزی/ }),
    )

    const dialog = screen.getByRole('dialog', {
      name: 'انتخاب غذای روز',
    })

    expect(dialog).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', {
        name: /زرشک پلو با مرغ/,
      }),
    )

    expect(onChange).toHaveBeenCalledExactlyOnceWith('2')
    expect(dialog).not.toHaveAttribute('open')
  })
})
