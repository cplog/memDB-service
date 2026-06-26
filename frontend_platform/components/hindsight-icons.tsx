import { cn } from '@/lib/utils'

type IconProps = { className?: string; title?: string }

/** Faceted memory shard — portal mark, not a generic brain. */
export function MarkIcon({ className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('shrink-0', className)}
      fill="none"
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <path
        d="M8 1.2 13.2 4.8v6.4L8 14.8 2.8 11.2V4.8L8 1.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 1.2v13.6M2.8 4.8l10.4 6.4M13.2 4.8 2.8 11.2" stroke="currentColor" strokeWidth="0.65" opacity="0.5" />
    </svg>
  )
}

export function ChevronIcon({ className, open }: IconProps & { open?: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className={cn('shrink-0', className)} aria-hidden>
      <path
        d={open ? 'M2 3.5 5 6.5 8 3.5' : 'M3.5 2 6.5 5 3.5 8'}
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Spinner({ className }: IconProps) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin',
        className
      )}
      aria-hidden
    />
  )
}

export function SidebarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={cn('shrink-0', className)} fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export function LeaveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={cn('shrink-0', className)} fill="none" aria-hidden>
      <path d="M6 3H4.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5H6M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}
