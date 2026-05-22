import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AdminState {
  sidebarOpen: boolean;
  notifications: Notification[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  sidebarOpen: false,
  notifications: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [...s.notifications, { ...n, id: crypto.randomUUID() }],
    })),
  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));
