import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import WeekSkeleton from './WeekSkeleton'

afterEach(() => {
  vi.useRealTimers()
})

describe('WeekSkeleton', () => {
  it('renders a loading status and six placeholder rows', () => {
    render(<WeekSkeleton />)

    expect(
      screen.getByRole('status', {
        name: 'در حال بارگذاری برنامه هفتگی',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByText('در حال دریافت برنامه غذایی هفته…'),
    ).toBeInTheDocument()

    expect(
      screen.getAllByTestId('week-skeleton-row'),
    ).toHaveLength(6)
  })

  it('reveals the skeleton after the short delay', () => {
    vi.useFakeTimers()

    const { container } = render(<WeekSkeleton />)

    const content = container.querySelector(
      '[data-testid="week-skeleton-content"]',
    )

    expect(content).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(159)
    })

    expect(content).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(content).toHaveClass('opacity-100')
  })
})
