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
import FlightAnalysis from './pages/FlightAnalysis';
import GaggleView from './pages/GaggleView';
import Leaderboards from './pages/Leaderboards';
import PilotPerformance from './pages/PilotPerformance';
import FlightComparison from './pages/FlightComparison';
import MissionsPage from './pages/MissionsPage';
import MissionEditorPage from './pages/MissionEditorPage';
import MissionMediaPage from './pages/MissionMediaPage';
import LogbookPage from './pages/LogbookPage';
import LogbookEntryPage from './pages/LogbookEntryPage';
import EquipmentPage from './pages/EquipmentPage';
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
        <Route
          path="/flights/compare"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <FlightComparison />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/flights/gaggle"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <GaggleView />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/flights/:id"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <FlightAnalysis />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/leaderboards"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <Leaderboards />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/pilots/:id"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <PilotPerformance />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/missions"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <MissionsPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/missions/:id"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <MissionEditorPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/missions/:id/media"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <MissionMediaPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/logbook"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <LogbookPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/logbook/:id"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <LogbookEntryPage />
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/equipment"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <EquipmentPage />
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
