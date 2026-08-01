import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BedDouble,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageCircleCode,
  Package,
  ReceiptText,
  Presentation,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Ticket,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding } from '../settings/BrandingContext';

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

type NavGroup = {
  label: string;
  roles?: string[];
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    roles: ['ADMIN', 'TEACHER', 'STUDENT'],
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TEACHER'] },
      { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['ADMIN', 'TEACHER'] },
      { path: '/boards', label: 'Boards', icon: Kanban, roles: ['ADMIN', 'TEACHER'] },
      { path: '/student-portal', label: 'Student Portal', icon: GraduationCap, roles: ['ADMIN', 'STUDENT'] },
    ],
  },
  {
    label: 'Operations',
    roles: ['ADMIN', 'TEACHER', 'PARENT'],
    items: [
      { path: '/requisitions', label: 'Requisitions', icon: ShoppingCart, roles: ['ADMIN', 'TEACHER'] },
      { path: '/supply-chain', label: 'Supply Chain', icon: Truck, roles: ['ADMIN', 'TEACHER'] },
      { path: '/inventory', label: 'Inventory', icon: Package, roles: ['ADMIN', 'TEACHER'] },
      { path: '/store', label: 'Uniform Store', icon: Shirt, roles: ['ADMIN', 'TEACHER', 'PARENT'] },
      { path: '/tickets', label: 'Tickets', icon: Ticket, roles: ['ADMIN', 'TEACHER'] },
      { path: '/discipline', label: 'Discipline', icon: ShieldAlert, roles: ['ADMIN', 'TEACHER'] },
      { path: '/communications', label: 'Communications', icon: Presentation, roles: ['ADMIN', 'TEACHER'] },
      { path: '/payments', label: 'Payments', icon: ReceiptText, roles: ['ADMIN', 'TEACHER'] },
      { path: '/ai-assist', label: 'AI Assist', icon: MessageCircleCode, roles: ['ADMIN', 'TEACHER'] },
    ],
  },
  {
    label: 'Portals',
    roles: ['ADMIN', 'TEACHER', 'PARENT'],
    items: [
      { path: '/admissions', label: 'Admissions', icon: GraduationCap, roles: ['ADMIN', 'TEACHER'] },
      { path: '/students', label: 'Students', icon: Users, roles: ['ADMIN', 'TEACHER'] },
      { path: '/hostel', label: 'Hostel', icon: BedDouble, roles: ['ADMIN', 'TEACHER'] },
      { path: '/teacher-portal', label: 'Teacher Portal', icon: Presentation, roles: ['ADMIN', 'TEACHER'] },
      { path: '/parent-portal', label: 'Parent Portal', icon: Users, roles: ['ADMIN', 'PARENT'] },
    ],
  },
  {
    label: 'Administration',
    roles: ['ADMIN'],
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/settings/identity-integrations', label: 'Identity', icon: ShieldCheck },
    ],
  },
];

const isPathActive = (path: string, pathname: string) => {
  if (path === '/') return pathname === '/';
  if (path === '/settings') return pathname === '/settings';
  return pathname.startsWith(path);
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((group) => [group.label, false])),
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { branding } = useBranding();

  const activeRole = user?.role || 'ADMIN';
  const schoolName = branding?.schoolName || 'POPIN School';
  const profileName = user?.name || 'Workspace User';
  const roleLabel =
    activeRole === 'PARENT'
      ? 'Parent access'
      : activeRole === 'TEACHER'
        ? 'Teacher workspace'
        : activeRole === 'STUDENT'
          ? 'Student access'
          : 'Administration';
  const initials = profileName
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const visibleGroups = useMemo(
    () =>
      navGroups
        .filter((group) => !group.roles || group.roles.includes(activeRole))
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.roles || item.roles.includes(activeRole)),
        }))
        .filter((group) => group.items.length > 0),
    [activeRole],
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
    onMobileClose();
  };

  const content = (
    <div
      className={`flex h-full flex-col border-r border-slate-800 bg-[#0f172a] text-white transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-80'
      }`}
    >
      <div className={`flex h-16 items-center border-b border-white/10 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${schoolName} logo`}
              className="h-10 w-10 rounded-2xl bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/25">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{schoolName}</p>
              <p className="truncate text-xs text-white/50">{branding?.schoolMotto || 'Connected school operations'}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-5">
          {visibleGroups.map((group) => {
            const hasActiveItem = group.items.some((item) => isPathActive(item.path, location.pathname));
            const isOpen = collapsed || openGroups[group.label] || hasActiveItem;

            return (
              <div key={group.label}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35 transition hover:bg-white/5 hover:text-white/60"
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                )}
                {isOpen && (
                  <ul className="space-y-1">
                    {group.items.map(({ path, label, icon: Icon }) => {
                      const active = isPathActive(path, location.pathname);
                      return (
                        <li key={path}>
                          <NavLink
                            to={path}
                            onClick={onMobileClose}
                            title={collapsed ? label : undefined}
                            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                              active
                                ? 'bg-white text-slate-950 shadow-sm'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            } ${collapsed ? 'justify-center' : ''}`}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span className="truncate">{label}</span>}
                            {collapsed && (
                              <span className="pointer-events-none absolute left-full z-50 ml-2 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                                {label}
                              </span>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="rounded-2xl bg-white/6 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white">
                {initials || 'PU'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{profileName}</p>
                <p className="truncate text-xs text-white/45">{roleLabel}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-white/85 transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/80"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-screen shrink-0 lg:flex">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button className="fixed inset-0 bg-black/50" onClick={onMobileClose} aria-label="Close navigation overlay" />
          <aside className="relative z-10 flex h-full">
            <button
              onClick={onMobileClose}
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
