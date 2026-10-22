import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./NotificationsPage.css";

type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

type NotificationsPayload =
  | NotificationRecord[]
  | {
      data?: NotificationRecord[];
      items?: NotificationRecord[];
      notifications?: NotificationRecord[];
      meta?: { total?: number; unreadCount?: number };
      unreadCount?: number;
    };

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Notifikasi tidak dapat dimuat.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memproses notifikasi.";
}

function normalizeNotifications(
  payload: NotificationsPayload,
): NotificationRecord[] {
  const records = Array.isArray(payload)
    ? payload
    : (payload.data ?? payload.items ?? payload.notifications ?? []);

  return records
    .filter((item): item is NotificationRecord =>
      Boolean(item && typeof item.id === "string"),
    )
    .map((item) => ({
      ...item,
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title
          : "Notifikasi",
      message: typeof item.message === "string" ? item.message : "",
      isRead: Boolean(item.isRead),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    }));
}

function formatDateTime(value: string): string {
  if (!value) return "Waktu tidak tersedia";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getNotificationIcon(type?: string) {
  const normalized = type?.toLowerCase() ?? "";

  if (
    normalized.includes("budget") ||
    normalized.includes("payment") ||
    normalized.includes("subscription")
  ) {
    return Wallet;
  }

  return Bell;
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response =
        await apiClient.get<NotificationsPayload>("notifications");

      setNotifications(normalizeNotifications(response));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, reloadKey]);

  const handleMarkRead = useCallback(
    async (notification: NotificationRecord) => {
      if (notification.isRead || markingIds.includes(notification.id)) {
        return;
      }

      setActionError("");
      setMarkingIds((current) => [...current, notification.id]);

      try {
        await apiClient.patch(
          `notifications/${encodeURIComponent(notification.id)}/read`,
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  isRead: true,
                  readAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      } catch (requestError) {
        setActionError(getErrorMessage(requestError));
      } finally {
        setMarkingIds((current) =>
          current.filter((id) => id !== notification.id),
        );
      }
    },
    [markingIds],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAll) return;

    setActionError("");
    setIsMarkingAll(true);

    try {
      await apiClient.patch("notifications/read-all");

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) =>
          item.isRead ? item : { ...item, isRead: true, readAt },
        ),
      );
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unreadCount]);

  return (
    <section
      className="notifications-page"
      aria-labelledby="notifications-title"
    >
      <header className="notifications-heading">
        <div>
          <span className="notifications-eyebrow">ACTIVITY CENTER</span>
          <h2 id="notifications-title">Notifikasi</h2>
          <p>Pantau pembaruan akun, anggaran, dan aktivitas keuangan Anda.</p>
        </div>

        <div className="notifications-heading-actions">
          <span className="notifications-unread-count">
            {unreadCount} belum dibaca
          </span>

          <button
            type="button"
            className="notifications-secondary-button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{isLoading ? "Memuat..." : "Muat ulang"}</span>
          </button>
        </div>
      </header>

      {actionError && (
        <div className="notifications-alert" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="notifications-panel">
        <div className="notifications-panel-header">
          <div>
            <h3>Semua aktivitas</h3>
            <p>{notifications.length} notifikasi tersimpan</p>
          </div>

          <button
            type="button"
            className="notifications-mark-all-button"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0 || isMarkingAll || isLoading}
          >
            <CheckCheck size={16} aria-hidden="true" />
            <span>{isMarkingAll ? "Memproses..." : "Tandai semua dibaca"}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="notifications-state" role="status">
            <span className="notifications-spinner" aria-hidden="true" />
            <strong>Memuat notifikasi</strong>
            <p>Mohon tunggu sebentar.</p>
          </div>
        ) : error ? (
          <div className="notifications-state notifications-state-error">
            <CircleAlert size={28} aria-hidden="true" />
            <strong>Notifikasi gagal dimuat</strong>
            <p>{error}</p>

            <button
              type="button"
              className="notifications-primary-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state">
            <span className="notifications-empty-icon">
              <Bell size={26} aria-hidden="true" />
            </span>
            <strong>Belum ada notifikasi</strong>
            <p>Pembaruan penting akan muncul di sini saat tersedia.</p>
          </div>
        ) : (
          <ul className="notifications-list">
            {notifications.map((notification) => {
              const NotificationIcon = getNotificationIcon(notification.type);
              const isMarking = markingIds.includes(notification.id);

              return (
                <li
                  className={`notification-item${
                    notification.isRead
                      ? " notification-item-read"
                      : " notification-item-unread"
                  }`}
                  key={notification.id}
                >
                  <span className="notification-item-icon" aria-hidden="true">
                    <NotificationIcon size={19} />
                  </span>

                  <div className="notification-item-content">
                    <div className="notification-item-title-row">
                      <h4>{notification.title}</h4>

                      {!notification.isRead && (
                        <span
                          className="notification-unread-dot"
                          aria-label="Belum dibaca"
                        />
                      )}
                    </div>

                    <p>
                      {notification.message || "Ada pembaruan pada akun Anda."}
                    </p>

                    <span className="notification-timestamp">
                      <Clock3 size={13} aria-hidden="true" />
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>

                  {!notification.isRead && (
                    <button
                      type="button"
                      className="notification-read-button"
                      onClick={() => void handleMarkRead(notification)}
                      disabled={isMarking}
                      aria-label={`Tandai "${notification.title}" sudah dibaca`}
                      title="Tandai sudah dibaca"
                    >
                      <Check size={17} aria-hidden="true" />
                      <span>
                        {isMarking ? "Menyimpan..." : "Tandai dibaca"}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
