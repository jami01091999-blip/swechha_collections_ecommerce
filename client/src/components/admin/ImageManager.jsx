import { useRef, useState } from 'react';
import Img from '../shared/Img';
import Icon from '../shared/Icon';
import { uploadImage } from '../../lib/api';

function useUploads() {
  const [pending, setPending] = useState([]); // {id, name, progress, preview}
  const [error, setError] = useState('');
  const run = async (files, onDone) => {
    setError('');
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10 MB. Use a smaller photo.`);
        continue;
      }
      const id = `${Date.now()}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setPending((p) => [...p, { id, progress: 0, preview }]);
      try {
        const img = await uploadImage(file, (progress) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))));
        onDone(img);
      } catch (e) {
        setError(e.message);
      } finally {
        URL.revokeObjectURL(preview);
        setPending((p) => p.filter((x) => x.id !== id));
      }
    }
  };
  return { pending, error, setError, run };
}

/** Product photos: upload (Cloudinary), reorder, set cover, remove. First photo = cover. */
export default function ImageManager({ images, onChange, max = 8, invalid }) {
  const input = useRef(null);
  const { pending, error, setError, run } = useUploads();
  const latest = useRef(images);
  latest.current = images;

  const add = (img) => onChange([...latest.current, img].slice(0, max));
  const move = (i, dir) => {
    const next = [...images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const makeCover = (i) => onChange([images[i], ...images.filter((_, k) => k !== i)]);
  const remove = (i) => onChange(images.filter((_, k) => k !== i));
  const full = images.length + pending.length >= max;
  const iconBtn = 'w-7 h-7 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface flex items-center justify-center shadow-sm active:scale-90 disabled:opacity-30';

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <div key={img.url + i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-outline-variant/40 bg-surface-container">
            <Img src={img.url} alt={`Photo ${i + 1}`} width={240} className="w-full h-full object-cover" />
            {i === 0 ? (
              <span className="absolute top-1.5 left-1.5 bg-secondary text-white font-label-md text-[10px] px-2 py-0.5 rounded-full">Cover</span>
            ) : (
              <button type="button" onClick={() => makeCover(i)} className="absolute top-1.5 left-1.5 bg-surface-container-lowest/90 text-primary font-label-md text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                Set cover
              </button>
            )}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`} className={`absolute top-1.5 right-1.5 ${iconBtn}`}>
              <Icon name="close" className="text-[16px]" />
            </button>
            <div className="absolute bottom-1.5 inset-x-1.5 flex justify-between">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left" className={iconBtn}>
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move right" className={iconBtn}>
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-outline-variant/40 bg-surface-container">
            <img src={p.preview} alt="" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div className="h-full bg-primary-container transition-all" style={{ width: `${p.progress}%` }} />
            </div>
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-center px-2 transition-colors hover:bg-surface-container-low ${
              invalid ? 'border-error/60 bg-error-container/20' : 'border-[#C59B6A]/60 bg-[#FAF6F0]'
            }`}
          >
            <Icon name="add_a_photo" className="text-[26px] text-primary" />
            <span className="font-label-md text-[11px] text-primary font-semibold">Add photos</span>
            <span className="font-label-md text-[10px] text-on-surface-variant">Camera or gallery</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...e.target.files].slice(0, max - images.length);
          e.target.value = '';
          run(files, add);
        }}
      />
      {error && <p className="font-body-sm text-[12px] text-error mt-1.5">{error}</p>}
    </div>
  );
}

/** Single image (used for Lookbook banners). */
export function SingleImage({ value, onChange }) {
  const input = useRef(null);
  const { pending, error, setError, run } = useUploads();
  return (
    <div>
      <div className="relative aspect-[4/5] w-32 rounded-lg overflow-hidden border border-outline-variant/40 bg-surface-container">
        {pending[0] ? (
          <>
            <img src={pending[0].preview} alt="" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div className="h-full bg-primary-container" style={{ width: `${pending[0].progress}%` }} />
            </div>
          </>
        ) : (
          <Img src={value} alt="Banner" width={300} className="w-full h-full object-cover" />
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-surface-container-lowest/90 text-primary flex items-center justify-center shadow-sm"
          aria-label="Change banner photo"
        >
          <Icon name="add_a_photo" className="text-[18px]" />
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const files = [...e.target.files].slice(0, 1);
          e.target.value = '';
          run(files, (img) => onChange(img.url));
        }}
      />
      {error && <p className="font-body-sm text-[12px] text-error mt-1.5">{error}</p>}
    </div>
  );
}
