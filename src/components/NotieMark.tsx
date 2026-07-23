import { cn } from '@/lib/utils';

interface NotieMarkProps {
  className?: string;
  /** Display size preset. Header = large portrait in the app chrome. */
  size?: 'sm' | 'md' | 'header' | 'lg';
  alt?: string;
}

const SIZE: Record<NonNullable<NotieMarkProps['size']>, string> = {
  sm: 'h-8 w-6',
  md: 'h-10 w-8',
  /** Nearly fills the 125px desktop header — full eraser → notepad. */
  header: 'h-14 w-11 md:h-[108px] md:w-[82px]',
  lg: 'h-16 w-12',
};

/**
 * Full Notie mascot (eraser through notepad). Portrait frame, object-contain,
 * minimal inset so the whole character reads — not a face-only crop.
 */
export function NotieMark({ className, size = 'md', alt = '' }: NotieMarkProps) {
  return (
    <img
      src="/notie-icon.jpg"
      alt={alt}
      className={cn(
        'shrink-0 rounded-xl bg-card object-contain object-center ring-1 ring-border',
        SIZE[size],
        className,
      )}
      draggable={false}
    />
  );
}
