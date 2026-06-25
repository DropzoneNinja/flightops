import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePlatform } from '../../hooks/usePlatform';
import { useAuth } from '../../hooks/useAuth';
import BottomNavigationBar from './BottomNavigationBar';

type ActiveTab = 'map' | 'sites' | 'media' | 'tools' | 'logout' | 'logbook';

interface MobilePageLayoutProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  /** Show a back chevron button in the header */
  showBackButton?: boolean;
  /** Label shown next to the back button */
  backLabel?: string;
  /** Override default back action (default: navigate(-1)) */
  onBack?: () => void;
  /** Content to render on the right side of the mobile header */
  headerRight?: React.ReactNode;
}

/**
 * MobilePageLayout - Shared mobile layout for media pages.
 *
 * Renders a compact sticky header, scrollable content area with correct
 * bottom padding for the nav bar, and a platform-styled BottomNavigationBar.
 *
 * - iOS: frosted glass tab bar + left-edge swipe-back gesture
 * - Android: flat tab bar + Material ripple on tab buttons
 */
export default function MobilePageLayout({
  children,
  activeTab,
  showBackButton = false,
  backLabel = 'Back',
  onBack,
  headerRight,
}: MobilePageLayoutProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isIOS, isAndroid } = usePlatform();
  const { logout } = useAuth();

  const navVariant = isIOS ? 'ios' : isAndroid ? 'android' : 'default';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    switch (tab) {
      case 'map':
        navigate('/');
        break;
      case 'media':
        navigate('/media');
        break;
      case 'tools':
        navigate('/settings');
        break;
      case 'sites':
        navigate('/');
        break;
      case 'logbook':
        navigate('/logbook');
        break;
      default:
        break;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // iOS left-edge swipe-back
  const swipeHandlers = useSwipeable({
    onSwipedRight: isIOS
      ? ({ initial }) => {
          if (initial[0] < 20) {
            handleBack();
          }
        }
      : () => {},
    delta: 30,
    preventScrollOnSwipe: false,
    trackMouse: false,
  });

  if (!isMobile) {
    // On desktop, render children unwrapped — each page handles its own desktop layout
    return <>{children}</>;
  }

  return (
    <div
      className="flex flex-col bg-gray-100 overflow-hidden"
      style={{ height: '100dvh' }}
      {...swipeHandlers}
    >
      {/* Compact sticky header — padded for iOS status bar / notch */}
      <header
        className="bg-white border-b border-gray-200 sticky top-0 z-10 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center px-4 py-3 gap-3 min-h-[52px]">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="touch-target p-2 -ml-2 text-gray-700 flex items-center gap-1"
              aria-label={`Back to ${backLabel}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">{backLabel}</span>
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 flex-1 truncate">
            Flight Memories
          </h1>
          {headerRight && (
            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
            </div>
          )}
        </div>
      </header>

      {/* Scrollable content — padded to avoid bottom nav */}
      <main className="flex-1 overflow-y-auto pb-safe">
        {children}
      </main>

      {/* Bottom navigation bar with safe area inset */}
      <div
        className="shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <BottomNavigationBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          variant={navVariant}
        />
      </div>
    </div>
  );
}
