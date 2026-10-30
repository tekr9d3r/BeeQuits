// The bee mark as plain SVG for ImageResponse (generated icons and share images).
export function OgBee({ size, ink, paper }: { size: number; ink: string; paper: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <ellipse cx="8.2" cy="7.6" rx="4.2" ry="2.8" transform="rotate(-30 8.2 7.6)" fill="none" stroke={ink} strokeWidth="1.4" />
      <ellipse cx="15.8" cy="7.6" rx="4.2" ry="2.8" transform="rotate(30 15.8 7.6)" fill="none" stroke={ink} strokeWidth="1.4" />
      <rect x="7.5" y="9" width="9" height="12" rx="4.5" fill={ink} />
      <rect x="7.5" y="13.2" width="9" height="1.4" fill={paper} />
      <rect x="7.5" y="16.4" width="9" height="1.4" fill={paper} />
      <circle cx="18.6" cy="19.4" r="1.6" fill="#ffc629" />
    </svg>
  );
}
