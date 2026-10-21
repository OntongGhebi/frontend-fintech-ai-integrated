import { useCallback, useEffect, useState } from "react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import "./RecurringPerformanceSection.css";

type TransactionType = "INCOME" | "EXPENSE";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: string | number;
  description: string | null;
  frequency: Frequency;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  account?: { name?: string } | null;
  category?: { name?: string } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return "Belum dijalankan";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getFrequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case "DAILY":
      return "Harian";
    case "WEEKLY":
      return "Mingguan";
    case "YEARLY":
      return "Tahunan";
    default:
      return "Bulanan";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Tidak dapat terhubung ke backend. Pastikan server API aktif.";
    }
    return error.message || "Gagal memuat transaksi berulang.";
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan saat memuat transaksi berulang.";
}

function parseRecurringTransactions(response: unknown): RecurringTransaction[] {
  if (!Array.isArray(response)) {
    throw new Error(
      "Format respons daftar transaksi berulang tidak sesuai kontrak API.",
    );
  }

  return response.filter(
    (item): item is RecurringTransaction =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      (item.type === "INCOME" || item.type === "EXPENSE") &&
      typeof item.isActive === "boolean" &&
      ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(item.frequency) &&
      Number.isFinite(Number(item.amount)),
  );
}

export function RecurringPerformanceSection() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadItems = useCallback(async () => {
    try {
      const response = await apiClient.get<unknown>("/recurring-transactions");

      setItems(parseRecurringTransactions(response));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reloadItems = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems, reloadKey]);

  const activeItems = items.filter((item) => item.isActive);
  const inactiveCount = items.length - activeItems.length;

  const monthlyIncomeEstimate = activeItems.reduce(
    (total, item) =>
      item.type === "INCOME"
        ? total +
          Number(item.amount) *
            (item.frequency === "DAILY"
              ? 30
              : item.frequency === "WEEKLY"
                ? 4.345
                : item.frequency === "YEARLY"
                  ? 1 / 12
                  : 1)
        : total,
    0,
  );

  const monthlyExpenseEstimate = activeItems.reduce(
    (total, item) =>
      item.type === "EXPENSE"
        ? total +
          Number(item.amount) *
            (item.frequency === "DAILY"
              ? 30
              : item.frequency === "WEEKLY"
                ? 4.345
                : item.frequency === "YEARLY"
                  ? 1 / 12
                  : 1)
        : total,
    0,
  );

  return (
    <section
      className="recurring-performance"
      aria-labelledby="recurring-performance-title"
    >
      <div className="recurring-performance-heading">
        <div>
          <span className="eyebrow">RECURRING FINANCES</span>
          <h2 id="recurring-performance-title">Transaksi berulang</h2>
          <p>
            Pantau pemasukan rutin dan pengeluaran terjadwal dalam satu tempat.
          </p>
        </div>

        <button
          className="recurring-refresh-button"
          type="button"
          onClick={reloadItems}
          disabled={isLoading}
        >
          {isLoading ? "Memuat..." : "↻ Perbarui"}
        </button>
      </div>

      {errorMessage && (
        <div className="recurring-error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={reloadItems}
            disabled={isLoading}
          >
            Coba lagi
          </button>
        </div>
      )}

      {!errorMessage && (
        <>
          <div className="recurring-summary-grid" aria-busy={isLoading}>
            <article className="recurring-summary-card">
              <span>Transaksi aktif</span>
              <strong>{isLoading ? "…" : activeItems.length}</strong>
              <small>Dari {items.length} transaksi berulang</small>
            </article>

            <article className="recurring-summary-card recurring-summary-card--income">
              <span>Estimasi pemasukan bulanan</span>
              <strong>
                {isLoading ? "…" : formatCurrency(monthlyIncomeEstimate)}
              </strong>
              <small>Perkiraan dari jadwal aktif</small>
            </article>

            <article className="recurring-summary-card recurring-summary-card--expense">
              <span>Estimasi pengeluaran bulanan</span>
              <strong>
                {isLoading ? "…" : formatCurrency(monthlyExpenseEstimate)}
              </strong>
              <small>Perkiraan dari jadwal aktif</small>
            </article>
          </div>

          {!isLoading && items.length === 0 ? (
            <div className="recurring-empty-state">
              <span aria-hidden="true">↻</span>
              <strong>Belum ada transaksi berulang</strong>
              <p>
                Jadwal pemasukan rutin dan pengeluaran berulang akan ditampilkan
                di sini setelah dibuat.
              </p>
            </div>
          ) : (
            !isLoading && (
              <div className="recurring-list">
                <div className="recurring-list-heading">
                  <h3>Jadwal transaksi</h3>
                  <span>{inactiveCount} tidak aktif</span>
                </div>

                {items.map((item) => (
                  <article className="recurring-item" key={item.id}>
                    <div className="recurring-item-symbol" aria-hidden="true">
                      {item.type === "INCOME" ? "↗" : "↘"}
                    </div>

                    <div className="recurring-item-main">
                      <strong>
                        {item.description?.trim() ||
                          (item.type === "INCOME"
                            ? "Pemasukan rutin"
                            : "Pengeluaran rutin")}
                      </strong>
                      <span>
                        {getFrequencyLabel(item.frequency)}
                        {item.category?.name ? ` · ${item.category.name}` : ""}
                      </span>
                      <small>Berikutnya: {formatDate(item.nextRunAt)}</small>
                    </div>

                    <div className="recurring-item-end">
                      <strong
                        className={
                          item.type === "INCOME"
                            ? "recurring-amount--income"
                            : "recurring-amount--expense"
                        }
                      >
                        {item.type === "INCOME" ? "+" : "−"}
                        {formatCurrency(Number(item.amount))}
                      </strong>
                      <span
                        className={
                          item.isActive
                            ? "recurring-status recurring-status--active"
                            : "recurring-status recurring-status--inactive"
                        }
                      >
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
