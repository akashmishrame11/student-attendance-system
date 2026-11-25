import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, GraduationCap, KeyRound, LogOut, Menu, UserCircle, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NAV } from "./navigation";
import api from "../services/api";
import { Avatar } from "../components/ui";
import { timeAgo, titleCase } from "../utils/format";

function Sidebar({ role, onNavigate }) {
  return (
    <nav className="flex h-full flex-col">
      <Link to={`/${role}`} className="flex h-16 shrink-0 items-center gap-3 px-5" onClick={onNavigate}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-white">Attendify</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">College ERP</p>
        </div>
      </Link>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
        {NAV[role].map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.section}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-brand-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"}`
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && cb();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function NotificationBell({ role }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useOutside(ref, () => setOpen(false));

  const load = async () => {
    try {
      const { data } = await api.get("/notifications", { params: { limit: 8 } });
      setItems(data.data);
      setUnread(data.meta.unread);
    } catch { /* ignore polling errors */ }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [location.pathname]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    load();
    if (n.link) navigate(n.link === "/notices" ? `/${role}/notices` : n.link);
  };
  const readAll = async () => {
    await api.patch("/notifications/read-all").catch(() => {});
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs font-medium text-brand-600 hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up</li>}
            {items.map((n) => (
              <li key={n._id}>
                <button onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? "" : "bg-brand-50/40"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-brand-500"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-slate-500">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{titleCase(n.type)} · {timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to={`/${role}/notifications`} onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-slate-50">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useOutside(ref, () => setOpen(false));
  const sub = user.role === "student" ? profile?.rollNumber : user.role === "faculty" ? profile?.designation : "Administrator";
  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
        <Avatar name={user.name} src={user.avatar} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{user.name}</span>
          <span className="block text-xs text-slate-500">{sub}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link to={`/${user.role}/profile`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserCircle className="h-4 w-4" /> My profile</Link>
          <Link to={`/${user.role}/profile?tab=password`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><KeyRound className="h-4 w-4" /> Change password</Link>
          <button onClick={doLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" /> Log out</button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="app-root min-h-screen bg-slate-50">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">
        <Sidebar role={user.role} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
            <Sidebar role={user.role} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-500">{titleCase(user.role)} Portal</p>
          </div>
          <NotificationBell role={user.role} />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
