// Welcome/connect hero: the app icon stacked over the "GreenBerry" wordmark.
// The icon is the same art as the macOS app icon (public/app-icon.svg).
export function BrandLogo({ iconSize = 92 }: { iconSize?: number }) {
  return (
    <div className="brand-logo">
      <img
        className="brand-logo__icon"
        src="/app-icon.svg"
        alt=""
        width={iconSize}
        height={iconSize}
        draggable={false}
      />
      <div className="mark">GreenBerry</div>
    </div>
  );
}
