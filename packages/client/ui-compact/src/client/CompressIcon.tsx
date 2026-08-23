/**
 * Turn-tail compress glyph: two diagonal arrows converging on the center —
 * the shrink/compact reading, drawn to match the small icon actions beside it.
 */

export function CompressIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 19 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4.4 4.4L9.2 9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8.72 6.08L9.2 9.2L6.08 8.72"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.6 14.6L9.8 9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M10.28 12.92L9.8 9.8L12.92 10.28"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
