export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  // A stylised ember/flame — the "ash" in AshVault.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2c1.5 3 4.5 4.5 4.5 8.5A4.5 4.5 0 0 1 12 15a4.5 4.5 0 0 1-4.5-4.5C7.5 6.5 10.5 5 12 2Z"
        fill="url(#ember)"
      />
      <path
        d="M12 12.5c.9 1.2 2 2 2 3.7A2 2 0 0 1 12 18a2 2 0 0 1-2-1.8c0-1.7 1.1-2.5 2-3.7Z"
        fill="#0b0b0f"
        fillOpacity="0.55"
      />
      <path
        d="M6 20.5c1.8-1 3.9-1.5 6-1.5s4.2.5 6 1.5"
        stroke="var(--muted)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="ember" x1="12" y1="2" x2="12" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}
