import { Utensils } from 'lucide-react'

type BrandVariant = 'default' | 'login' | 'sidebar' | 'mobile'

export default function BrandMark({ variant = 'default' }: { variant?: BrandVariant }) {
  const isLogin = variant === 'login'
  const isMobile = variant === 'mobile'

  const containerClass = [
    'flex items-center gap-[10px] font-bold tracking-[-0.3px]',
    isMobile ? 'me-auto text-[15px]' : 'text-[17px]',
    isLogin ? 'relative z-[1]' : '',
    variant === 'sidebar' ? 'px-[7px] pb-7' : '',
  ].filter(Boolean).join(' ')

  const symbolClass = [
    'grid place-items-center rounded-[11px]',
    isMobile ? 'h-8 w-8' : 'h-9 w-9',
    isLogin
      ? 'bg-[#ffffff1c] text-white'
      : 'bg-accent-soft text-accent',
  ].join(' ')

  return (
    <div className={containerClass}>
      <span className={symbolClass} aria-hidden="true">
        <Utensils size={21} strokeWidth={1.8} />
      </span>
      <span>پی‌آی فود</span>
    </div>
  )
}
