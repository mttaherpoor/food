import { textButtonClass } from './buttonStyles'

export default function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="my-3 flex items-center justify-between gap-3 rounded-[9px] border border-[#f0c9cb] bg-[#fff4f4] px-[14px] py-3 text-sm leading-[1.7] text-[#8b242a]" role="alert"><span>{message}</span>{onRetry && <button className={textButtonClass} onClick={onRetry} type="button">تلاش دوباره</button>}</div>
}
