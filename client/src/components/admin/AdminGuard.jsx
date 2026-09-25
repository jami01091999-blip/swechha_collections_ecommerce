import { Link, Navigate, useLocation } from 'react-router-dom';
import Icon from '../shared/Icon';
import { Button, Card } from '../ui';
import { AdminPageLoading } from './AdminLoading';
import { isStaff, loginPath, useAuth } from '../../lib/auth';

/** Shown to signed-in customers who open /adminDivya. */
export function NoAdminAccess({ email }) {
  return (
    <div className="flex-1 flex items-center justify-center px-gutter-mobile py-16">
      <Card className="w-full md:max-w-sm shadow-luxury flex flex-col items-center text-center p-5">
        <div className="w-12 h-12 rounded-full bg-secondary-container/60 border border-secondary/40 flex items-center justify-center text-primary">
          <Icon name="lock" className="text-[24px]" />
        </div>
        <h1 className="font-headline-sm text-headline-sm text-primary mt-3">You don't have access to the admin area</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          You're signed in as <span className="font-semibold text-on-surface break-all">{email}</span>. Ask the shop owner to add you to the
          team.
        </p>
        <Button as={Link} to="/" className="w-full mt-4 text-center">
          Back to the shop
        </Button>
      </Card>
    </div>
  );
}

/** Staff and admins only. Guests go to /login?next=…, customers see NoAdminAccess. */
export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AdminPageLoading />;
  if (!user) return <Navigate to={loginPath(location)} replace />;
  if (!isStaff(user)) return <NoAdminAccess email={user.email} />;
  return children;
}
