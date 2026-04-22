/**
 * BottomNavigationBar - Mobile navigation with context-based tabs
 *
 * Provides a fixed bottom navigation bar with 4 tabs:
 * - Map: Return to map view
 * - Sites: Add/manage flight sites
 * - Logout: Log out of the application
 * - Tools: Access airspace and plot controls
 */

interface BottomNavigationBarProps {
  activeTab: 'map' | 'sites' | 'media' | 'logout' | 'tools';
  onTabChange: (tab: 'map' | 'sites' | 'media' | 'logout' | 'tools') => void;
  onLogout: () => void;
  isMissionMode?: boolean;
  onToggleMissionMode?: () => void;
  /** Visual variant: 'ios' = frosted glass, 'android' = flat + ripple, 'default' = existing style */
  variant?: 'ios' | 'android' | 'default';
}

export default function BottomNavigationBar({
  activeTab,
  onTabChange,
  onLogout,
  isMissionMode = false,
  onToggleMissionMode = () => {},
  variant = 'default',
}: BottomNavigationBarProps) {
  type TabId = 'map' | 'sites' | 'media' | 'missions' | 'logout' | 'tools';
  const navBgClass =
    variant === 'ios'
      ? 'bg-white/80 backdrop-blur-md border-t border-gray-200'
      : 'bg-white border-t-2 border-gray-300';
  const tabRippleClass = variant === 'android' ? 'ripple' : '';
  const tabs: { id: TabId; label: string; icon: JSX.Element; disabled: boolean }[] = [
    {
      id: 'map' as const,
      label: 'Map',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'sites' as const,
      label: 'Sites',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'media' as const,
      label: 'Album',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'missions' as const,
      label: isMissionMode ? 'Weather' : 'Missions',
      icon: isMissionMode ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'tools' as const,
      label: 'Tools',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'logout' as const,
      label: 'Logout',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      disabled: false,
    },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 shadow-2xl z-[1000] no-select ${navBgClass}`}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around items-center h-14">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (!tab.disabled) {
                if (tab.id === 'logout') {
                  onLogout();
                } else if (tab.id === 'missions') {
                  onToggleMissionMode();
                } else {
                  onTabChange(tab.id as 'map' | 'sites' | 'media' | 'logout' | 'tools');
                }
              }
            }}
            disabled={tab.disabled}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 touch-target transition-colors ${tabRippleClass} ${
              activeTab === tab.id || (tab.id === 'missions' && isMissionMode)
                ? 'text-blue-600 bg-blue-50'
                : tab.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 active:bg-gray-100'
            }`}
          >
            {tab.icon}
            <span className="text-xs font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
