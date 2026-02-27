import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import SetupUsername from './pages/SetupUsername';
import ResetPassword from './pages/ResetPassword';
import MapView from './pages/MapView';
import Settings from './pages/Settings';
import MediaCalendar from './pages/MediaCalendar';
import DailyGallery from './pages/DailyGallery';
import SiteGallery from './pages/SiteGallery';
import FilteredGallery from './pages/FilteredGallery';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-username" element={<SetupUsername />} />
        <Route
          path="/reset-password"
          element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/media"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <MediaCalendar />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/media/search"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <FilteredGallery />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/media/:date"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <DailyGallery />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/media/site/:siteId"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <SiteGallery />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
