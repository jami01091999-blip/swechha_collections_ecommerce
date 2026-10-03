import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './context/Toast';
import { queryClient } from './lib/queryClient';
import { AuthProvider, PageSpinner, RequireAuth } from './lib/auth';
import { WishlistSync } from './lib/wishlist';
import { BagSync } from './lib/bag';
import PublicLayout from './components/public/PublicLayout';
import Home from './pages/public/Home';
import Collection from './pages/public/Collection';
import ProductDetail from './pages/public/ProductDetail';
import NotFound from './pages/public/NotFound';
import { AdminShellLoading } from './components/admin/AdminLoading';
import { ADMIN_BASE } from './lib/constants';

// Admin code is split into its own chunks so customers never download it.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Products = lazy(() => import('./pages/admin/Products'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm'));
const Lookbook = lazy(() => import('./pages/admin/Lookbook'));
const Team = lazy(() => import('./pages/admin/Team'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const ShopRules = lazy(() => import('./pages/admin/ShopRules'));
const Activity = lazy(() => import('./pages/admin/Activity'));
// Only signed-in customers need the account page, so it is split out too.
const Account = lazy(() => import('./pages/public/Account'));
const Login = lazy(() => import('./pages/public/Login'));
const Saved = lazy(() => import('./pages/public/Saved'));
const Bag = lazy(() => import('./pages/public/Bag'));
const Checkout = lazy(() => import('./pages/public/Checkout'));
const MyOrders = lazy(() => import('./pages/public/MyOrders'));
const OrderDetail = lazy(() => import('./pages/public/OrderDetail'));
const Policy = lazy(() => import('./pages/public/Policy'));
const signedIn = (el) => (
  <RequireAuth>
    <Suspense fallback={<PageSpinner />}>{el}</Suspense>
  </RequireAuth>
);
const page = (el) => <Suspense fallback={<PageSpinner />}>{el}</Suspense>;

// UI kit gallery, dev server only: import.meta.env.DEV is false in `vite build`, so this import is dropped.
const UiKit = import.meta.env.DEV ? lazy(() => import('./dev/UiKit')) : null;
const devRoutes = UiKit
  ? [
      {
        path: '/__ui',
        element: (
          <Suspense fallback={null}>
            <UiKit />
          </Suspense>
        ),
      },
    ]
  : [];

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <WishlistSync />
          <BagSync />
          <ScrollRestoration getKey={(location) => location.pathname + location.search} />
          <Outlet />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const routes = [
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/collection', element: <Collection /> },
          { path: '/product/:slug', element: <ProductDetail /> },
          { path: '/login', element: page(<Login />) },
          { path: '/saved', element: page(<Saved />) },
          { path: '/bag', element: page(<Bag />) },
          { path: '/checkout', element: signedIn(<Checkout />) },
          { path: '/account/orders', element: signedIn(<MyOrders />) },
          { path: '/account/orders/:orderNumber', element: signedIn(<OrderDetail />) },
          { path: '/policies/:page', element: page(<Policy />) },
          {
            path: '/account',
            element: (
              <RequireAuth>
                <Suspense fallback={<PageSpinner />}>
                  <Account />
                </Suspense>
              </RequireAuth>
            ),
          },
        ],
      },
      {
        path: ADMIN_BASE,
        element: (
          <Suspense fallback={<AdminShellLoading />}>
            <AdminLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'products', element: <Products /> },
          { path: 'products/new', element: <ProductForm /> },
          { path: 'products/:id', element: <ProductForm /> },
          { path: 'lookbook', element: <Lookbook /> },
          { path: 'team', element: <Team /> },
          { path: 'orders', element: <Orders /> },
          { path: 'orders/:id', element: <AdminOrderDetail /> },
          { path: 'customers', element: <Customers /> },
          { path: 'coupons', element: <Coupons /> },
          { path: 'shop', element: <ShopRules /> },
          { path: 'activity', element: <Activity /> },
        ],
      },
      ...devRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
