import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  RefreshCw,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";

import { NotificationPreferencesCard } from "./NotificationPreferencesCard";
import "./NotificationsPage.css";

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type?: string;
  channel: string;
  status: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationPayload {
  data?: Array<Record<string, unknown>>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

type FilterStatus = "ALL" | "UNREAD" | "READ";

const PAGE_SIZE = 10;
const NOTIFICATION_UPDATED_EVENT = "fintech:notifications-updated";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Notifikasi tidak dapat diproses.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memproses notifikasi.";
}

function normalizeNotifications(
  payload: NotificationPayload,
): NotificationRecord[] {
  return (payload.data ?? [])
    .filter((item) => typeof item.id === "string")
    .map((item) => {
      const status = String(item.status ?? "UNREAD").toUpperCase();

      return {
        id: String(item.id),
        title:
          typeof item.title === "string" && item.title.trim()
            ? item.title
            : "Notifikasi",
        message: typeof item.message === "string" ? item.message : "",
        type: typeof item.type === "string" ? item.type : undefined,
        channel: String(item.channel ?? "IN_APP").toUpperCase(),
        status,
        isRead: status === "READ",
        readAt: typeof item.readAt === "string" ? item.readAt : null,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
      };
    });
}

function formatDateTime(value: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function NotificationIcon({ type }: { type?: string }) {
  const normalized = type?.toLowerCase() ?? "";

  if (
    normalized.includes("budget") ||
    normalized.includes("payment") ||
    normalized.includes("subscription")
  ) {
    return <Wallet size={19} />;
  }

  return <Bell size={19} />;
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const [markingIds, setMarkingIds] = useState<string[]>([]);

  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get<{ count: number }>(
        "notifications/unread-count",
      );

      setUnreadCount(
        Number.isFinite(response?.count) ? Math.max(0, response.count) : 0,
      );
    } catch {
      // Pertahankan jumlah terakhir jika request badge gagal.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        channel: "IN_APP",
      });

      if (filter !== "ALL") {
        params.set("status", filter);
      }

      const response = await apiClient.get<NotificationPayload>(
        `notifications?${params.toString()}`,
      );

      setNotifications(normalizeNotifications(response));
      setTotal(response.meta?.total ?? 0);
      setTotalPages(response.meta?.totalPages ?? 0);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setNotifications([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void loadNotifications();
    void loadUnreadCount();
  }, [loadNotifications, loadUnreadCount, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const refreshAll = useCallback(() => {
    setReloadKey((current) => current + 1);

    window.dispatchEvent(new Event(NOTIFICATION_UPDATED_EVENT));
  }, []);

  const handleMarkRead = useCallback(
    async (notification: NotificationRecord) => {
      if (
        notification.channel !== "IN_APP" ||
        notification.isRead ||
        markingIds.includes(notification.id)
      ) {
        return;
      }

      setMarkingIds((current) => [...current, notification.id]);

      setActionError("");

      try {
        await apiClient.patch(
          `notifications/${encodeURIComponent(notification.id)}/read`,
        );

        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  status: "READ",
                  isRead: true,
                  readAt: new Date().toISOString(),
                }
              : item,
          ),
        );

        setUnreadCount((current) => Math.max(0, current - 1));

        window.dispatchEvent(new Event(NOTIFICATION_UPDATED_EVENT));

        if (filter === "UNREAD") {
          if (notifications.length === 1 && page > 1) {
            setPage((current) => current - 1);
          } else {
            setReloadKey((current) => current + 1);
          }
        }
      } catch (requestError) {
        setActionError(getErrorMessage(requestError));
      } finally {
        setMarkingIds((current) =>
          current.filter((id) => id !== notification.id),
        );
      }
    },
    [filter, markingIds, notifications.length, page],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAll) {
      return;
    }

    setActionError("");
    setIsMarkingAll(true);

    try {
      await apiClient.patch("notifications/read-all");

      setUnreadCount(0);

      if (filter === "UNREAD") {
        setPage(1);
        setReloadKey((current) => current + 1);
      } else {
        setNotifications((current) =>
          current.map((item) => ({
            ...item,
            status: "READ",
            isRead: true,
            readAt: new Date().toISOString(),
          })),
        );
      }

      window.dispatchEvent(new Event(NOTIFICATION_UPDATED_EVENT));
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setIsMarkingAll(false);
    }
  }, [filter, isMarkingAll, unreadCount]);

  const rangeLabel = useMemo(() => {
    if (total === 0) {
      return "0 notifikasi";
    }

    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    return `${start}–${end} dari ${total} notifikasi`;
  }, [page, total]);

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
            onClick={refreshAll}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Memuat..." : "Muat ulang"}
          </button>
        </div>
      </header>

      {actionError && (
        <div className="notifications-alert" role="alert">
          <CircleAlert size={18} />
          <span>{actionError}</span>
        </div>
      )}

      <NotificationPreferencesCard />

      <div className="notifications-panel">
        <div className="notifications-panel-header">
          <div>
            <h3>Aktivitas notifikasi</h3>
            <p>{rangeLabel}</p>
          </div>

          <div className="notifications-panel-actions">
            <div
              className="notifications-filter"
              role="group"
              aria-label="Filter notifikasi"
            >
              {(["ALL", "UNREAD", "READ"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === "ALL"
                    ? "Semua"
                    : value === "UNREAD"
                      ? "Belum dibaca"
                      : "Sudah dibaca"}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="notifications-mark-all-button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || isMarkingAll || isLoading}
            >
              <CheckCheck size={16} />
              {isMarkingAll ? "Memproses..." : "Tandai semua dibaca"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="notifications-state" role="status">
            <span className="notifications-spinner" />
            <strong>Memuat notifikasi</strong>
            <p>Mohon tunggu sebentar.</p>
          </div>
        ) : error ? (
          <div className="notifications-state notifications-state-error">
            <CircleAlert size={28} />

            <strong>Notifikasi gagal dimuat</strong>

            <p>{error}</p>

            <button
              type="button"
              className="notifications-primary-button"
              onClick={refreshAll}
            >
              Coba lagi
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state">
            <span className="notifications-empty-icon">
              <Bell size={26} />
            </span>

            <strong>
              {filter === "UNREAD"
                ? "Tidak ada notifikasi baru"
                : filter === "READ"
                  ? "Belum ada notifikasi yang dibaca"
                  : "Belum ada notifikasi"}
            </strong>

            <p>Pembaruan penting akan muncul di sini saat tersedia.</p>
          </div>
        ) : (
          <ul className="notifications-list">
            {notifications.map((notification) => {
              const isUnread = !notification.isRead;
              const isMarking = markingIds.includes(notification.id);

              return (
                <li
                  className={`notification-item${
                    isUnread
                      ? " notification-item-unread"
                      : " notification-item-read"
                  }`}
                  key={notification.id}
                >
                  <span className="notification-item-icon" aria-hidden="true">
                    <NotificationIcon type={notification.type} />
                  </span>

                  <div className="notification-item-content">
                    <div className="notification-item-title-row">
                      <h4>{notification.title}</h4>

                      {isUnread && (
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
                      <Clock3 size={13} />
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      className="notification-read-button"
                      onClick={() => void handleMarkRead(notification)}
                      disabled={isMarking}
                    >
                      <Check size={17} />

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

        {!isLoading && !error && totalPages > 1 && (
          <div className="notifications-pagination">
            <span>{rangeLabel}</span>

            <div>
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={17} />
              </button>

              <span>
                Halaman {page} dari {totalPages}
              </span>

              <button
                type="button"
                aria-label="Halaman berikutnya"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
