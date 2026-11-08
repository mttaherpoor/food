export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'disabled'
  | 'dangerQuiet'
  | 'neutral'

export type ButtonSize = 'default' | 'day'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[9px] ' +
  'border font-semibold no-underline cursor-pointer ' +
  'transition-colors duration-150'

const sizes: Record<ButtonSize, string> = {
  default: 'min-h-[42px] px-[14px] py-[9px] text-sm',
  day:
    'min-h-[38px] whitespace-nowrap px-[11px] py-[9px] text-xs ' +
    'max-[680px]:min-h-9 max-[680px]:px-[9px] ' +
    'max-[680px]:py-[7px] max-[680px]:text-[11px]',
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-accent text-white ' +
    'hover:not-disabled:bg-[#145769]',
  secondary:
    'border-line bg-white text-ink hover:not-disabled:bg-raised',
  disabled:
    'border-line bg-raised text-muted',
  dangerQuiet:
    'border-transparent bg-white text-negative ' +
    'hover:not-disabled:bg-[#fff2f2]',
  neutral:
    'border-transparent bg-transparent text-ink',
}

export function buttonClass(
  variant: ButtonVariant = 'neutral',
  extra = '',
  size: ButtonSize = 'default',
): string {
  return [base, sizes[size], variants[variant], extra]
    .filter(Boolean)
    .join(' ')
}

export const iconButtonClass =
  'inline-grid h-[38px] w-[38px] shrink-0 cursor-pointer ' +
  'place-items-center rounded-[9px] border border-line ' +
  'bg-white hover:bg-raised'

export const textButtonClass =
  'inline-flex min-h-9 cursor-pointer items-center ' +
  'border-0 bg-transparent px-2 py-[5px] text-[13px] ' +
  'font-semibold text-accent'
