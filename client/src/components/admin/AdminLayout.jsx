import { Outlet } from 'react-router-dom';
import AdminGate from './AdminGate';

/** Phones: the Stitch admin canvas. Tablets & laptops: full-width admin with top navigation. */
export default function AdminLayout() {
  return (
    <div className="admin-root bg-[#f0eded] text-on-surface antialiased flex justify-center min-h-screen py-0 sm:py-6 md:py-0 selection:bg-primary-container selection:text-white">
      <div className="w-full max-w-[480px] md:max-w-none bg-background min-h-screen relative flex flex-col pb-28 md:pb-16 shadow-2xl md:shadow-none sm:rounded-[32px] md:rounded-none overflow-clip border md:border-0 border-outline-variant/30">
        <AdminGate>
          <Outlet />
        </AdminGate>
      </div>
    </div>
  );
}
