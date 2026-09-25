import { Link } from 'react-router-dom';
import Icon from '../../components/shared/Icon';

export default function NotFound({ message = 'This page does not exist.' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 bg-surface">
      <Icon name="checkroom" className="text-5xl text-outline" />
      <h1 className="font-headline-sm text-headline-sm text-primary mt-3">Not found</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{message}</p>
      <Link to="/" className="mt-5 bg-primary-container text-white px-5 py-2.5 rounded-xl font-label-lg text-label-lg tracking-wide">
        Back to catalogue
      </Link>
    </div>
  );
}
