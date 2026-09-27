import { cn } from '@/lib/utils'

const BAR_ROTATIONS = [0, 120, 180, 240, 300] as const

/** Live Collab "Hub" mark: five contributor bars and one live dot; inherits text color. */
export function LiveCollabMark({
  className,
  title
}: {
  className?: string
  title?: string
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('size-20 shrink-0', className)}
    >
      <g fill="currentColor" transform="translate(60 60)">
        {BAR_ROTATIONS.map((rotation) => (
          <rect
            key={rotation}
            x="-8"
            y="-54"
            width="16"
            height="38"
            rx="3"
            transform={`rotate(${rotation})`}
          />
        ))}
        <circle cx="0" cy="-44" r="10" transform="rotate(60)" />
      </g>
    </svg>
  )
}
