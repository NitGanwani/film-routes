import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout.js';
import { LoginPage, RegisterPage } from './pages/AuthPages.js';
import { ExplorePage } from './pages/ExplorePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ExplorePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
