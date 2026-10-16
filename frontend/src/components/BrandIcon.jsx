export default function BrandIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="currentColor" />
    </svg>
  );
}
