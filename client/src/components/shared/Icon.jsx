export default function Icon({ name, className = '', fill = false, ...rest }) {
  return (
    <span className={`material-symbols-outlined ${fill ? 'icon-fill' : ''} ${className}`} aria-hidden="true" {...rest}>
      {name}
    </span>
  );
}
