import { Utensils } from 'lucide-react'

export default function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid justify-items-center px-[18px] py-[54px] text-center text-muted">
      <span
        aria-hidden="true"
        className="grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-accent-soft text-accent"
      >
        <Utensils size={20} />
      </span>
      <h2 className="mt-[15px] mb-[5px] text-[17px] text-ink">{title}</h2>
      <p className="m-0 text-[13px] leading-[1.8]">{detail}</p>
    </div>
  )
}
