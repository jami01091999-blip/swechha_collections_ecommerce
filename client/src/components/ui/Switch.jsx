/** On/off switch with a label and optional hint. */
export default function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span>
        <span className="font-title-md text-[14px] text-on-surface block">{label}</span>
        {hint && <span className="font-body-sm text-[12px] text-on-surface-variant">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-11 h-6 rounded-full bg-surface-container-highest peer-checked:bg-primary-container transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#C59B6A]" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
