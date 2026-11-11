import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Modal from './Modal';
import { notifyAction } from '../lib/notify';
import { useBranding } from '../settings/BrandingContext';
import { apiRequest } from '../lib/api';

interface TopBarProps {
  onMobileMenuOpen: () => void;
  title: string;
}

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  readAt?: string | null;
  createdAt?: string;
  route?: string;
};

const notificationIcons: Record<string, React.ReactNode> = {
  approval: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  ticket: <Ticket className="h-4 w-4 text-blue-600" />,
  order: <PackageCheck className="h-4 w-4 text-indigo-600" />,
  fee: <CircleDollarSign className="h-4 w-4 text-amber-600" />,
  appointment: <CalendarDays className="h-4 w-4 text-rose-600" />,
};

const withNotificationRoute = (item: NotificationItem, role: string): NotificationItem => ({
  ...item,
  read: item.readAt !== undefined ? Boolean(item.readAt) : Boolean(item.read),
  time: item.time || (item.createdAt ? new Date(item.createdAt).toLocaleString() : ''),
  route:
    role === 'TEACHER' ? '/teacher-portal'
    : role === 'PARENT' ? '/parent-portal'
    : role === 'STUDENT' ? '/student-portal'
    : item.type === 'approval'
      ? '/requisitions'
      : item.type === 'ticket'
        ? '/tickets'
        : item.type === 'order'
          ? '/store'
          : item.type === 'fee'
            ? '/analytics'
            : '/parent-portal',
});

const quickCreateItems = [
  { label: 'New Student', route: '/students', icon: Users, message: 'Opened Student Management.' },
  { label: 'New Ticket', route: '/tickets', icon: Ticket, message: 'Opened Tickets.' },
  { label: 'New Requisition', route: '/requisitions/new', icon: ShoppingCart, message: 'Opened Requisition Create.' },
  { label: 'New Product', route: '/store', icon: PackageCheck, message: 'Opened Uniform Store.' },
];

const allSearchTargets = [
  { label: 'Dashboard', route: '/' },
  { label: 'Analytics', route: '/analytics' },
  { label: 'Boards', route: '/boards' },
  { label: 'AI Assist', route: '/ai-assist' },
  { label: 'Requisitions', route: '/requisitions' },
  { label: 'Supply Chain', route: '/supply-chain' },
  { label: 'Inventory', route: '/inventory' },
  { label: 'Uniform Store', route: '/store' },
  { label: 'Tickets', route: '/tickets' },
  { label: 'Disciplinary Module', route: '/discipline' },
  { label: 'Communications', route: '/communications' },
  { label: 'Payments', route: '/payments' },
  { label: 'Admissions', route: '/admissions' },
  { label: 'Students', route: '/students' },
  { label: 'Hostel', route: '/hostel' },
  { label: 'Parent Portal', route: '/parent-portal' },
  { label: 'Student Portal', route: '/student-portal' },
  { label: 'Teacher Portal', route: '/teacher-portal' },
  { label: 'Settings', route: '/settings' },
  { label: 'Identity Integrations', route: '/settings/identity-integrations' },
];

export default function TopBar({ onMobileMenuOpen, title }: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeModal, setActiveModal] = useState<'profile' | 'preferences' | 'help' | null>(null);
  const [preferences, setPreferences] = useState({
    compactMode: false,
    emailUpdates: true,
    desktopSounds: false,
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { branding } = useBranding();

  const role = user?.role || 'ADMIN';
  const notificationEndpoint = role === 'PARENT' ? '/parent/notifications'
    : role === 'TEACHER' ? '/teacher/notifications'
    : role === 'STUDENT' ? '/student/notifications' : '/admin/notifications';
  const profileName = user?.name || 'Workspace User';
  const profileEmail = user?.email || 'admin@popin.school';
  const initials = profileName
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const unreadCount = notifications.filter((item) => !item.read).length;
  const allowQuickCreate = !['PARENT', 'STUDENT'].includes(role);
  const searchTargets =
    role === 'PARENT'
      ? allSearchTargets.filter((item) => ['/parent-portal', '/store'].includes(item.route))
      : role === 'STUDENT'
        ? allSearchTargets.filter((item) => ['/student-portal', '/store'].includes(item.route))
      : allSearchTargets;

  const searchResults = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return [];
    return searchTargets.filter((item) => item.label.toLowerCase().includes(value)).slice(0, 6);
  }, [search, searchTargets]);

  useEffect(() => {
    const stored = window.localStorage.getItem('popin_user_preferences');
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        // ignore invalid local state
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNotifications([]);
    const refresh = () => apiRequest<NotificationItem[]>(notificationEndpoint)
      .then((items) => {
        if (!cancelled) setNotifications((Array.isArray(items) ? items : []).map((item) => withNotificationRoute(item, role)));
      })
      .catch(() => { if (!cancelled) setNotifications([]); });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener('popin-notifications-updated', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('popin-notifications-updated', refresh);
    };
  }, [role, user?.id, notificationEndpoint, notifOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
      if (createRef.current && !createRef.current.contains(event.target as Node)) setCreateOpen(false);
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearch('');
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openRoute = (route: string, message?: string) => {
    navigate(route);
    setCreateOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    setSearch('');
    if (message) notifyAction(message, 'success');
  };

  const savePreferences = () => {
    window.localStorage.setItem('popin_user_preferences', JSON.stringify(preferences));
    notifyAction('Preferences saved.', 'success');
    setActiveModal(null);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 px-4 backdrop-blur-md lg:px-8">
        <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center gap-4">
          <button
            onClick={onMobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          <div className="hidden min-w-[200px] sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Workspace</p>
            <h1 className="text-base font-semibold text-gray-950">{title}</h1>
          </div>

          <div className="max-w-xl flex-1" ref={searchRef}>
            <form
              className="relative"
              onSubmit={(event) => {
                event.preventDefault();
                const firstMatch = searchResults[0];
                if (firstMatch) {
                  openRoute(firstMatch.route, `Opened ${firstMatch.label}.`);
                  return;
                }
                notifyAction('No matching workspace section found.', 'warning');
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search modules, pages, and actions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30"
                aria-label="Search"
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <ul className="py-1">
                    {searchResults.map((item) => (
                      <li key={item.route}>
                        <button
                          type="button"
                          onClick={() => openRoute(item.route, `Opened ${item.label}.`)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {allowQuickCreate && (
              <div className="relative hidden sm:block" ref={createRef}>
                <button
                  onClick={() => {
                    setCreateOpen((value) => !value);
                    setNotifOpen(false);
                    setProfileOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>New</span>
                </button>

                {createOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <ul className="py-1">
                      {quickCreateItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.label}>
                            <button
                              onClick={() => openRoute(item.route, item.message)}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                            >
                              <Icon className="h-4 w-4 text-blue-600" />
                              {item.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setNotifOpen((value) => !value);
                  setCreateOpen(false);
                  setProfileOpen(false);
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">Notifications</span>
                    <button
                      className="text-xs font-medium text-blue-600 hover:underline"
                      onClick={async () => {
                        try {
                          const endpoint = `${notificationEndpoint}/read-all`;
                          const items = await apiRequest<NotificationItem[]>(endpoint, { method: 'POST' });
                          setNotifications((Array.isArray(items) ? items : []).map((item) => withNotificationRoute(item, role)));
                        } catch (error: any) {
                          notifyAction(error.message || 'Could not mark notifications as read.', 'error');
                        }
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={async () => {
                            if (['PARENT', 'TEACHER', 'STUDENT'].includes(role) && !item.read) {
                              try {
                                await apiRequest(`${notificationEndpoint}/${item.id}/read`, { method: 'POST' });
                              } catch (error: any) {
                                notifyAction(error.message || 'Could not mark the notification as read.', 'error');
                                return;
                              }
                            }
                            setNotifications((current) =>
                              current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
                            );
                            openRoute(item.route || '/', `${item.title} opened.`);
                          }}
                          className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${item.read ? '' : 'bg-blue-50/50'}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                              {notificationIcons[item.type]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              <p className="mt-0.5 truncate text-xs text-gray-500">{item.message}</p>
                              <p className="mt-1 text-xs text-gray-400">{item.time}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setNotifOpen(false);
                  setCreateOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-gray-100"
                aria-label="User menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">
                  {initials}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 sm:block">{profileName}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{profileName}</p>
                    <p className="text-xs text-gray-500">{role}</p>
                  </div>
                  <ul className="py-1">
                    <li>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setActiveModal('profile');
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <UserRound className="h-4 w-4 text-gray-500" />
                        Profile
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setActiveModal('preferences');
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4 text-gray-500" />
                        Preferences
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setActiveModal('help');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        Help
                      </button>
                    </li>
                    <li className="mt-1 border-t border-gray-100">
                      <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                        onClick={signOut}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <Modal title="Profile" isOpen={activeModal === 'profile'} onClose={() => setActiveModal(null)}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{profileName}</p>
              <p className="text-sm text-gray-500">{profileEmail}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">{role}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-400">School</p>
              <p className="mt-1 font-medium text-gray-800">{branding?.schoolName || 'POPIN School'}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-400">Account</p>
              <p className="mt-1 font-medium text-gray-800">{role}</p>
            </div>
          </div>
          <div className="flex justify-end">
            {role !== 'STUDENT' ? (
              <button
                onClick={() => {
                  setActiveModal(null);
                  navigate('/settings');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Open Settings
                <ExternalLink className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveModal(null);
                  navigate('/student-portal');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Open Portal
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal title="Preferences" isOpen={activeModal === 'preferences'} onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <PreferenceToggle
            label="Compact mode"
            description="Tighten workspace spacing for denser screens."
            checked={preferences.compactMode}
            onChange={(value) => setPreferences((current) => ({ ...current, compactMode: value }))}
          />
          <PreferenceToggle
            label="Email updates"
            description="Receive workflow summaries and action alerts by email."
            checked={preferences.emailUpdates}
            onChange={(value) => setPreferences((current) => ({ ...current, emailUpdates: value }))}
          />
          <PreferenceToggle
            label="Desktop sounds"
            description="Play subtle sounds for new alerts and queue events."
            checked={preferences.desktopSounds}
            onChange={(value) => setPreferences((current) => ({ ...current, desktopSounds: value }))}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setActiveModal(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button onClick={savePreferences} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Save Preferences
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Help" isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)}>
        <div className="space-y-4 text-sm text-gray-600">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold text-gray-900">Getting around</p>
            <p className="mt-1">Use the sidebar for modules, the top search for quick jumps, and notifications to stay on top of urgent work.</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="font-semibold text-gray-900">Support contact</p>
            <p className="mt-1">
              {branding?.email || 'admin@popin.school'}
              {branding?.phone ? ` • ${branding.phone}` : ''}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                setActiveModal(null);
                navigate(role === 'STUDENT' ? '/student-portal' : '/settings/identity-integrations');
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {role === 'STUDENT' ? 'Return to Portal' : 'Open Support Tools'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
      <div className="pr-4">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-600" />
    </label>
  );
}
