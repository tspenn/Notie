import { cn } from '@/lib/utils';
import readingLampSrc from '@/assets/reading-lamp.jpg';

export const READING_LAMP_SRC = readingLampSrc;

interface ReadingLampProps {
  className?: string;
  /** Display height in pixels (width scales with the image). */
  size?: number;
  /** Soft glow pulse behind the lamp. Defaults to true. */
  lit?: boolean;
  alt?: string;
}

/**
 * Reading lamp for Inspiration — used on the Library shelf in place of any
 * lighthouse / beacon iconography.
 */
export function ReadingLamp({
  className,
  size = 28,
  lit = true,
  alt = 'Reading lamp',
}: ReadingLampProps) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      {lit && (
        <span
          className="pointer-events-none absolute inset-[-18%] rounded-full bg-moss/20 animate-lamp-glow"
          aria-hidden="true"
        />
      )}
      <img
        src={READING_LAMP_SRC}
        alt={alt}
        width={size}
        height={size}
        className="relative z-[1] h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
