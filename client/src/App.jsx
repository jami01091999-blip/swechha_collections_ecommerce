import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { ToastProvider } from './context/Toast';
import PublicLayout from './components/public/PublicLayout';
import Home from './pages/public/Home';
import Collection from './pages/public/Collection';
import ProductDetail from './pages/public/ProductDetail';
import NotFound from './pages/public/NotFound';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Products from './pages/admin/Products';
import ProductForm from './pages/admin/ProductForm';
import Lookbook from './pages/admin/Lookbook';
import { ADMIN_BASE } from './lib/constants';

function Root() {
  return (
    <ToastProvider>
      <ScrollRestoration getKey={(location) => location.pathname + location.search} />
      <Outlet />
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/collection', element: <Collection /> },
          { path: '/product/:slug', element: <ProductDetail /> },
        ],
      },
      {
        path: ADMIN_BASE,
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'products', element: <Products /> },
          { path: 'products/new', element: <ProductForm /> },
          { path: 'products/:id', element: <ProductForm /> },
          { path: 'lookbook', element: <Lookbook /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
