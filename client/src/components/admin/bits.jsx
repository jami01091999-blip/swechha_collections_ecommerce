import Img from '../shared/Img';
import { coverImage } from '../../lib/format';

// Chips, Stepper, Sheet and ConfirmSheet moved to components/ui.

export function Thumb({ p, src }) {
  return (
    <div className="w-14 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30">
      <Img src={src ?? coverImage(p)} alt={p?.name || ''} width={140} className="w-full h-full object-cover" />
    </div>
  );
}
