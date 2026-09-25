// Loading states shown while admin code is downloaded (admin routes are lazy-loaded so
// customers never download them). Same markup as AdminLayout + the AdminGate spinner.

export function AdminPageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center px-gutter-mobile py-16">
      <div className="flex flex-col items-center gap-2 text-on-surface-variant">
        <span className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
        <span className="font-label-md text-label-md">Opening atelier…</span>
      </div>
    </div>
  );
}

export function AdminShellLoading() {
  return (
    <div className="admin-root bg-[#f0eded] text-on-surface antialiased flex justify-center min-h-screen py-0 sm:py-6 md:py-0 selection:bg-primary-container selection:text-white">
      <div className="w-full max-w-[480px] md:max-w-none bg-background min-h-screen relative flex flex-col pb-28 md:pb-16 shadow-2xl md:shadow-none sm:rounded-[32px] md:rounded-none overflow-clip border md:border-0 border-outline-variant/30">
        <AdminPageLoading />
      </div>
    </div>
  );
}
