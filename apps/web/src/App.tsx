import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout.js';
import { RequireSession } from './components/RequireSession.js';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AccountPages.js';
import { LoginPage, RegisterPage } from './pages/AuthPages.js';
import { ExplorePage } from './pages/ExplorePage.js';
import { JourneyPage } from './pages/JourneyPage.js';
import { JourneysPage } from './pages/JourneysPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { RoutePage } from './pages/RoutePage.js';
import { WelcomePage } from './pages/WelcomePage.js';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ExplorePage />} />
        <Route path="routes/:routeId" element={<RoutePage />} />
        <Route
          path="journeys"
          element={
            <RequireSession>
              <JourneysPage />
            </RequireSession>
          }
        />
        <Route
          path="journeys/:routeId"
          element={
            <RequireSession>
              <JourneyPage />
            </RequireSession>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
