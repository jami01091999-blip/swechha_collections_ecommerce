import { useState } from 'react';
import { imgUrl } from '../../lib/format';

/** Lazy image with a soft placeholder and a quiet fallback if the photo fails to load. */
export default function Img({ src, alt = '', width = 600, className = '', eager = false, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} bg-surface-container-low flex items-center justify-center text-outline/60`} aria-label={alt} role="img">
        <span className="material-symbols-outlined text-3xl">checkroom</span>
      </div>
    );
  }
  return (
    <img
      src={imgUrl(src, width)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
