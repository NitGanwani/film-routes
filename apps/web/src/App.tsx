import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { useSession } from './session/SessionProvider.js';
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
import { MyRoutesPage } from './pages/MyRoutesPage.js';
import { NewRoutePage } from './pages/NewRoutePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { RoutePage } from './pages/RoutePage.js';
import { WelcomePage } from './pages/WelcomePage.js';

// The landing page brings GSAP with it: load it only for visitors who see it.
const LandingPage = lazy(() =>
  import('./pages/LandingPage.js').then((module) => ({
    default: module.LandingPage,
  })),
);

/** `/`: the front door for visitors, Explore for people who are signed in. */
function Home() {
  const session = useSession();
  // A stored session is being resumed: show neither until we know who this is.
  if (session.status === 'loading') return null;
  if (session.status === 'authenticated') return <ExplorePage />;
  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<ExplorePage />} />
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
        <Route
          path="my-routes"
          element={
            <RequireSession>
              <MyRoutesPage />
            </RequireSession>
          }
        />
        <Route
          path="my-routes/new"
          element={
            <RequireSession>
              <NewRoutePage />
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
