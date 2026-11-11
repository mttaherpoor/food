import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import CatalogInventory from './CatalogInventory'
import { server } from '../../test/server'
import { ApiError, apiClient } from '../../api/client'

const food = {
  id: 1,
  name: 'غذای آزمایشی',
  price: 100000,
  container_price: 10000,
  total_price: 110000,
  image: null,
  image_data: {
    url: '/static/images/defaults/default-food.webp',
    alt: 'تصویر غذا',
  },
}

function renderInventory() {
  const onChanged = vi.fn(async () => {})

  render(
    <CatalogInventory
      foods={[food]}
      sides={[]}
      drinks={[]}
      onChanged={onChanged}
    />,
  )

  return { onChanged }
}

async function openFoodEditor() {
  const user = userEvent.setup()

  await user.click(screen.getByText('غذاها (1)'))
  await user.click(screen.getByRole('button', { name: 'ویرایش' }))

  return user
}

describe('CatalogInventory food image editing', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:food-preview'),
    })

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('previews and uploads a new image with multipart FormData', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      data: { id: 1, name: food.name },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as never)

    const { onChanged } = renderInventory()
    const user = await openFoodEditor()

    const image = screen.getByAltText('تصویر غذای آزمایشی')

    expect(image).toHaveAttribute(
      'src',
      '/static/images/defaults/default-food.webp',
    )

    const file = new File(
      ['test-image'],
      'test-food.png',
      { type: 'image/png' },
    )

    await user.upload(
      screen.getByLabelText('انتخاب تصویر جدید'),
      file,
    )

    expect(image).toHaveAttribute('src', 'blob:food-preview')

    await user.click(
      screen.getByRole('button', { name: 'ذخیره تغییرات' }),
    )

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1)
    })

    expect(requestSpy).toHaveBeenCalledTimes(1)

    const config = requestSpy.mock.calls[0][0]

    expect(config.url).toBe('/foods/1')
    expect(config.method).toBe('PATCH')

    const body = config.data
    expect(body).toBeInstanceOf(FormData)

    const form = body as FormData
    expect(form.get('name')).toBe(food.name)
    expect(form.get('price')).toBe('100000')
    expect(form.get('container_price')).toBe('10000')

    const uploadedFile = form.get('image')
    expect(uploadedFile).toBeInstanceOf(File)
    expect((uploadedFile as File).name).toBe('test-food.png')
  })

  it('preserves the existing image when editing only the price', async () => {
    let contentType = ''
    let payload: unknown = null

    server.use(
      http.patch('*/api/v1/foods/1', async ({ request }) => {
        contentType = request.headers.get('content-type') ?? ''
        payload = await request.json()

        return HttpResponse.json({ id: 1 })
      }),
    )

    const { onChanged } = renderInventory()
    const user = await openFoodEditor()

    const priceInput = screen.getByLabelText('قیمت (تومان)')

    await user.clear(priceInput)
    await user.type(priceInput, '125000')

    await user.click(
      screen.getByRole('button', { name: 'ذخیره تغییرات' }),
    )

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledTimes(1)
    })

    expect(contentType).toContain('application/json')
    expect(payload).toMatchObject({
      name: food.name,
      price: 125000,
      container_price: 10000,
    })

    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps the editor open and shows an error if upload fails', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockRejectedValue(
      new ApiError(400, {
        image: ['فرمت تصویر نامعتبر است.'],
      }),
    )

    const { onChanged } = renderInventory()
    const user = await openFoodEditor()

    const file = new File(
      ['invalid-image'],
      'invalid.png',
      { type: 'image/png' },
    )

    await user.upload(
      screen.getByLabelText('انتخاب تصویر جدید'),
      file,
    )

    await user.click(
      screen.getByRole('button', { name: 'ذخیره تغییرات' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'فرمت تصویر نامعتبر است.',
    )

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(onChanged).not.toHaveBeenCalled()

    expect(
      screen.getByRole('button', { name: 'ذخیره تغییرات' }),
    ).toBeInTheDocument()
  })

})
