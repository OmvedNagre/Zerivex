export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <span aria-label="Zerivex" role="img" className={`zx-brand-logo${compact ? ' zx-brand-logo--compact' : ''}`}><img src="/brand/zerivex.jpg" alt="" /></span>;
}
