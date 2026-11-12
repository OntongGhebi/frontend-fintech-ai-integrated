import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { apiClient } from "../../lib/api-client";
import "./NotificationBadge.css";

const NOTIFICATION_UPDATED_EVENT = "fintech:notifications-updated";

interface UnreadCountResponse {
  count?: number;
}

export function NotificationBell() {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get<UnreadCountResponse>(
        "notifications/unread-count",
      );

      const count = Number(response?.count);

      if (Number.isFinite(count)) {
        setUnreadCount(Math.max(0, Math.floor(count)));
      }
    } catch {
      // Pertahankan jumlah terakhir jika request gagal.
    }
  }, []);

  // Refresh saat berpindah halaman.
  useEffect(() => {
    void refreshUnreadCount();
  }, [location.pathname, refreshUnreadCount]);

  // Dengarkan perubahan notifikasi dari halaman lain.
  useEffect(() => {
    const handleNotificationsUpdated = () => {
      void refreshUnreadCount();
    };

    const handleWindowFocus = () => {
      void refreshUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    };

    window.addEventListener(
      NOTIFICATION_UPDATED_EVENT,
      handleNotificationsUpdated,
    );

    window.addEventListener("focus", handleWindowFocus);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        NOTIFICATION_UPDATED_EVENT,
        handleNotificationsUpdated,
      );

      window.removeEventListener("focus", handleWindowFocus);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshUnreadCount]);

  const badgeLabel = `${unreadCount} notifikasi belum dibaca`;

  const accessibleLabel =
    unreadCount > 0 ? `Buka notifikasi, ${badgeLabel}` : "Buka notifikasi";

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        `layout-notification-button topbar-notification-link${
          isActive ? " is-active" : ""
        }`
      }
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <Bell size={19} strokeWidth={1.8} aria-hidden="true" />

      {unreadCount > 0 && (
        <span className="topbar-notification-badge" aria-hidden="true">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </NavLink>
  );
}
