export function PinBanner({ label }: { label: string }) {
  if (!label.trim()) return null;
  return (
    <div className="pin-banner" role="status">
      <div className="pin-banner-inner" title={label}>
        <span className="pin-banner-now">NOW</span>
        <p className="pin-banner-text">{label}</p>
      </div>
    </div>
  );
}
