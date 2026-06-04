import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Layout({ user, onLogout, children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/timesheets', label: 'Timesheets', icon: '📋' },
    { path: '/employee-hours', label: 'Employee Hours', icon: '🕐' },
    { path: '/export', label: 'Export', icon: '📥', adminOnly: true },
    { path: '/settings', label: 'Settings', icon: '⚙️', adminOnly: true },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900">Timesheet</h1>
          <p className="text-sm text-gray-600">Management System</p>
        </div>

        <nav className="p-4">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') {
              return null;
            }

            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t mt-auto">
          <div className="mb-4">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow">
          <div className="px-8 py-6">
            <h2 className="text-3xl font-bold text-gray-900">
              {getPageTitle(location.pathname)}
            </h2>
          </div>
        </header>

        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/dashboard':
      return 'Project Dashboard';
    case '/timesheets':
      return 'Timesheet Management';
    case '/export':
      return 'Export Data';
    case '/employee-hours':
      return 'Employee Hours Report';
    case '/settings':
      return 'Settings';
    default:
      return 'Dashboard';
  }
}
