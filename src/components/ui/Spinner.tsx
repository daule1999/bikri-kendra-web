'use client';

/**
 * Spinner — tapered comet arc.
 *
 * Width graduates from zero (pointed tail) → full stroke (wide rounded head).
 * Built as a filled SVG path so actual geometry narrows — not a gradient trick.
 *
 * Props:
 *   size      — 'sm' | 'md' (default) | 'lg'
 *   color     — any CSS color or variable (default: indigo-600)
 *   className — extra classes (e.g. Tailwind margins)
 */

const SIZES = {
  sm: { s: 24, sw: 2.5 },
  md: { s: 38, sw: 3.5 },
  lg: { s: 54, sw: 4.5 },
};

const SEGMENTS    = 64;                        // polygon smoothness
const ARC_RADIANS = 2 * Math.PI * 0.75;       // 270°
const TAIL_ANGLE  = -Math.PI / 2;             // 12 o'clock (top)

const f = (n: number) => n.toFixed(2);

/**
 * Builds a filled SVG path for a 270° comet arc:
 *   - starts at a point (tail, top, 12 o'clock)
 *   - outer edge arcs clockwise, widening from r to r+maxHW
 *   - rounded semicircle cap at head (9 o'clock)
 *   - inner edge returns to tail, narrowing back to r
 *   - closes at the original tail point
 */
function buildComet(cx: number, cy: number, r: number, maxHW: number): string {
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];

  for (let i = 0; i <= SEGMENTS; i++) {
    const t     = i / SEGMENTS;                       // 0=tail … 1=head
    const angle = TAIL_ANGLE + ARC_RADIANS * t;        // clockwise in SVG (y-down)
    const hw    = maxHW * t;                           // half-width at this point
    const cos   = Math.cos(angle);
    const sin   = Math.sin(angle);

    outer.push([cx + (r + hw) * cos,              cy + (r + hw) * sin]);
    inner.push([cx + Math.max(r - hw, 0.5) * cos, cy + Math.max(r - hw, 0.5) * sin]);
  }

  const [tx, ty]   = outer[0];           // tail (single convergence point)
  const [hox, hoy] = outer[SEGMENTS];    // head outer edge
  const [hix, hiy] = inner[SEGMENTS];    // head inner edge

  let d = `M ${f(tx)} ${f(ty)}`;

  // Outer arc: tail → head, widening
  for (let i = 1; i <= SEGMENTS; i++) {
    d += ` L ${f(outer[i][0])} ${f(outer[i][1])}`;
  }

  // Rounded semicircle cap at head (sweep=1 = clockwise = continues spin direction)
  d += ` A ${f(maxHW)} ${f(maxHW)} 0 0 1 ${f(hix)} ${f(hiy)}`;

  // Inner arc: head → tail, narrowing back to point
  for (let i = SEGMENTS - 1; i >= 0; i--) {
    d += ` L ${f(inner[i][0])} ${f(inner[i][1])}`;
  }

  return d + ' Z';
}

// Pre-compute path strings at module load (shapes are deterministic)
const PATHS = Object.fromEntries(
  Object.entries(SIZES).map(([key, { s, sw }]) => {
    const cx = s / 2;
    return [key, buildComet(cx, cx, cx - sw, sw)];
  })
) as Record<keyof typeof SIZES, string>;

export function Spinner({
  size      = 'md',
  color     = '#4f46e5',
  className = '',
}: {
  size?:      'sm' | 'md' | 'lg';
  color?:     string;
  className?: string;
}) {
  const { s, sw } = SIZES[size];
  const cx = s / 2;

  return (
    /*
     * Outer span runs `spinner-hue` (defined in globals.css):
     *   filter: hue-rotate(0→360deg) over 6 s, looping forever.
     * CSS filter applies to all pixels rendered inside the span —
     * so the SVG's fill color shifts through the full spectrum automatically.
     * No color prop changes needed — ever.
     */
    <span
      className={`inline-flex ${className}`}
      style={{
        animation: 'spinner-hue 6s linear infinite',
      }}
    >
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        className="animate-spin"
        style={{ animationTimingFunction: 'linear', animationDuration: '0.85s' }}
        aria-hidden="true"
      >
        {/* Faint full-circle track */}
        <circle
          cx={cx} cy={cx} r={cx - sw}
          fill="none"
          stroke={color}
          strokeOpacity={0.1}
          strokeWidth={sw * 0.5}
        />
        {/* Tapered comet — filled shape, width 0 at tail → sw at head */}
        <path d={PATHS[size]} fill={color} />
      </svg>
    </span>
  );
}
