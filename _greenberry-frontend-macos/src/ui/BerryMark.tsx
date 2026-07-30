// Inline brand mark — a green berry with a calyx crown and leaf, matching the
// macOS app icon (src-tauri/icons). Used in the title-bar brand; scales via `size`.
export function BerryMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <defs>
        <radialGradient id="gbBerryG" cx="0.36" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#B7F5CE" />
          <stop offset="0.55" stopColor="#3FC47D" />
          <stop offset="1" stopColor="#0E8A47" />
        </radialGradient>
      </defs>
      {/* leaf */}
      <path d="M14.5 8 C17.5 4.5 21 5.5 21 8.5 C19 9.5 16 9.5 14.5 8 Z" fill="#0C7A3E" />
      {/* berry body */}
      <circle cx="11.5" cy="14.5" r="7.2" fill="url(#gbBerryG)" />
      {/* calyx crown */}
      <path
        d="M11.5 2.2 L12.21 4.03 L14.16 4.13 L12.64 5.37 L13.15 7.27 L11.5 6.2 L9.85 7.27 L10.36 5.37 L8.84 4.13 L10.79 4.03 Z"
        fill="#0A5C30"
      />
      {/* specular highlight */}
      <ellipse cx="9" cy="12" rx="2.1" ry="1.4" fill="#FFFFFF" fillOpacity="0.5" transform="rotate(-25 9 12)" />
    </svg>
  );
}
