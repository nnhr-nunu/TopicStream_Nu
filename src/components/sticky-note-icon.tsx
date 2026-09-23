export function StickyNoteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M5.5 3.75h10.2c.7 0 1.3.55 1.3 1.25v8.2c0 .2-.08.4-.22.54l-4.04 4.04c-.15.14-.34.22-.54.22H5.5c-.7 0-1.25-.56-1.25-1.25V5c0-.7.56-1.25 1.25-1.25Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M12.6 18.8V14.3c0-.7.56-1.25 1.25-1.25h4.45"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M8 8.2h7.2M8 11.2h7.2M8 14.2h3.4"
        stroke="color-mix(in oklab, var(--sticky-foreground, #5a4630) 90%, black)"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
