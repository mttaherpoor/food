import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import QuantityField from './QuantityField'

function TestQuantity() {
  const [quantity, setQuantity] = useState(1)

  return (
    <QuantityField
      label="تعداد غذا"
      value={quantity}
      onChange={setQuantity}
    />
  )
}

describe('QuantityField', () => {
  it('starts at one and cannot decrease below one', async () => {
    const user = userEvent.setup()
    render(<TestQuantity />)

    const input = screen.getByRole('spinbutton', {
      name: 'تعداد غذا',
    })

    const decrease = screen.getByRole('button', {
      name: 'کاهش تعداد غذا',
    })

    expect(input).toHaveValue(1)
    expect(decrease).toBeDisabled()

    await user.click(
      screen.getByRole('button', {
        name: 'افزایش تعداد غذا',
      }),
    )

    expect(input).toHaveValue(2)
    expect(decrease).toBeEnabled()

    await user.click(decrease)

    expect(input).toHaveValue(1)
    expect(decrease).toBeDisabled()
  })

  it('allows clearing one and typing two without producing twelve', async () => {
    const user = userEvent.setup()
    render(<TestQuantity />)

    const input = screen.getByRole('spinbutton', {
      name: 'تعداد غذا',
    })

    await user.clear(input)
    await user.type(input, '2')

    expect(input).toHaveValue(2)

    await user.tab()
    expect(input).toHaveValue(2)
  })

  it('restores the valid value when the input is left empty', async () => {
    const user = userEvent.setup()
    render(<TestQuantity />)

    const input = screen.getByRole('spinbutton', {
      name: 'تعداد غذا',
    })

    await user.clear(input)
    await user.tab()

    expect(input).toHaveValue(1)
  })
})
