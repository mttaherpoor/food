export default function LoadingRows() {
  return (
    <div
      aria-label="در حال بارگذاری"
      aria-live="polite"
      className="mt-[15px] grid gap-px"
    >
      {[0, 1, 2].map((index) => (
        <span
          aria-hidden="true"
          className="loading-shimmer h-[73px] border-b border-line"
          key={index}
        />
      ))}
    </div>
  )
}
