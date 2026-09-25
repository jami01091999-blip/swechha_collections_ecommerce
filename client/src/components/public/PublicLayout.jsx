import { Outlet } from 'react-router-dom';
import { DesktopHeader } from './Header';

/**
 * Phones: the Stitch mobile shell (widened from 390px to 480px so every phone is full width).
 * Tablets & laptops (768px+): full-width layout with a top navigation bar.
 */
export default function PublicLayout() {
  return (
    <div className="bg-background text-on-surface antialiased font-body-md text-body-md min-h-screen flex justify-center selection:bg-primary-container selection:text-white">
      <div className="w-full max-w-[480px] md:max-w-none bg-surface relative min-h-screen shadow-2xl md:shadow-none flex flex-col border-x md:border-x-0 border-outline-variant/20 overflow-x-clip">
        <DesktopHeader />
        <Outlet />
      </div>
    </div>
  );
}
