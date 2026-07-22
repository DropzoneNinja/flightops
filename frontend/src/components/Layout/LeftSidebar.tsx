import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface User {
  username?: string;
  email: string;
  is_admin: boolean;
}

interface LeftSidebarProps {
  user: User | null;
  showAirspace: boolean;
  onToggleAirspace: () => void;
  onAddSite?: () => void;
  isAddingSite?: boolean;
  onLogout: () => void;
}

const MapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

const AirspaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const AddSiteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21z" />
    <line x1="12" y1="6.5" x2="12" y2="12.5" />
    <line x1="9" y1="9.5" x2="15" y2="9.5" />
  </svg>
);

const MediaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const LogbookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const MissionsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const EquipmentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 10c2.5-6.5 17.5-6.5 20 0" />
    <line x1="2" y1="10" x2="12" y2="20" />
    <line x1="12" y1="5" x2="12" y2="20" />
    <line x1="22" y1="10" x2="12" y2="20" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function LeftSidebar({ user, showAirspace, onToggleAirspace, onAddSite = () => {}, isAddingSite = false, onLogout }: LeftSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const isMapActive = location.pathname === '/';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        avatarRef.current && !avatarRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.username || user?.email || '';
  const initials = displayName
    .split(/[@.\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('');

  const shortName = displayName.split(/[@.\s_-]/)[0] || displayName;

  const navItems = [
    { id: 'map', label: 'Map', Icon: MapIcon, action: () => navigate('/') },
    ...(isMapActive
      ? [{ id: 'add-site', label: 'Add Site', Icon: AddSiteIcon, action: onAddSite, isActive: isAddingSite }]
      : []),
    {
      id: 'airspace',
      label: 'Airspace',
      Icon: AirspaceIcon,
      action: onToggleAirspace,
      isActive: showAirspace,
    },
    { id: 'missions', label: 'Missions', Icon: MissionsIcon, action: () => navigate('/missions') },
    { id: 'media', label: 'Media', Icon: MediaIcon, action: () => navigate('/media') },
    { id: 'logbook', label: 'Logbook', Icon: LogbookIcon, action: () => navigate('/logbook') },
    { id: 'equipment', label: 'Equipment', Icon: EquipmentIcon, action: () => navigate('/equipment') },
  ];

  return (
    <div className="flex flex-col items-center py-4 h-full w-[72px] shrink-0 bg-[#0d1421] border-r border-[#1e2a3a] z-[600]">
      {/* Logo */}
      <div className="mb-6">
        <img src="/logo.png" alt="FlightOps" className="w-10 h-10 object-contain" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ id, label, Icon, action, isActive }) => {
          let active: boolean;
          if (id === 'airspace') active = isActive ?? false;
          else if (id === 'add-site') active = isActive ?? false;
          else if (id === 'map') active = isMapActive;
          else if (id === 'media') active = location.pathname.startsWith('/media');
          else if (id === 'logbook') active = location.pathname.startsWith('/logbook');
          else if (id === 'missions') active = location.pathname.startsWith('/missions');
          else if (id === 'equipment') active = location.pathname.startsWith('/equipment');
          else active = false;
          return (
            <button
              key={id}
              onClick={action}
              title={label}
              className={`flex flex-col items-center justify-center gap-1 w-14 py-2 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-[#6b7fa3] hover:text-white hover:bg-[#1e2a3a]'
              }`}
            >
              <Icon />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="w-10 h-px bg-[#1e2a3a] my-3" />

      {/* User avatar */}
      <div className="relative">
        <button
          ref={avatarRef}
          onClick={() => setShowUserMenu(v => !v)}
          className="flex flex-col items-center gap-1 cursor-pointer group"
          title={displayName}
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold group-hover:bg-blue-500 transition-colors select-none">
            {initials || '?'}
          </div>
          <span className="text-[9px] text-[#6b7fa3] group-hover:text-white transition-colors max-w-[60px] truncate leading-none">
            {shortName}
          </span>
        </button>

        {/* User dropdown — positioned to the right of the avatar */}
        {showUserMenu && (
          <div
            ref={menuRef}
            className="absolute bottom-0 left-full ml-2 w-44 bg-[#1a2234] border border-[#2a3a54] rounded-xl shadow-2xl overflow-hidden z-[700]"
          >
            <div className="px-4 py-3 border-b border-[#2a3a54]">
              <p className="text-white text-sm font-medium truncate">{displayName}</p>
            </div>
            <button
              onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#a0b3cc] hover:text-white hover:bg-[#243048] transition-colors"
            >
              <SettingsIcon />
              Settings
            </button>
            <button
              onClick={() => { setShowUserMenu(false); onLogout(); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-[#243048] transition-colors"
            >
              <LogoutIcon />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
