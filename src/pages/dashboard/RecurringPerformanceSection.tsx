import { useCallback, useEffect, useState } from "react";
import { Tag } from "lucide-react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import { CATEGORY_ICON_MAP } from "../../components/categories/CategoryIconPicker";

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
  categoryId?: string | null;
  account?: { name?: string } | null;
  category?: {
    id?: string;
    name?: string;
    icon?: string | null;
    color?: string | null;
  } | null;
}

interface CategoryMetadata {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string | null;
  color: string | null;
  isActive?: boolean;
  deletedAt?: string | null;
}

interface CategoryEnvelope {
  data: CategoryMetadata[];
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

function parseCategories(response: unknown): CategoryMetadata[] {
  const categories = Array.isArray(response)
    ? response
    : typeof response === "object" &&
        response !== null &&
        "data" in response &&
        Array.isArray((response as CategoryEnvelope).data)
      ? (response as CategoryEnvelope).data
      : [];

  return categories.filter(
    (item): item is CategoryMetadata =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      (item.type === "INCOME" || item.type === "EXPENSE"),
  );
}

function getCategoryColor(
  color: string | null | undefined,
): string | undefined {
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return undefined;
  }

  return color;
}

function getMonthlyMultiplier(frequency: Frequency): number {
  switch (frequency) {
    case "DAILY":
      return 30;
    case "WEEKLY":
      return 4.345;
    case "YEARLY":
      return 1 / 12;
    default:
      return 1;
  }
}

export function RecurringPerformanceSection() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryMetadata[]>([]);
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

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiClient.get<unknown>("/categories");

      setCategories(parseCategories(response));
    } catch {
      // Metadata kategori bersifat opsional.
      // Kegagalan endpoint ini tidak boleh mengganggu daftar recurring.
      setCategories([]);
    }
  }, []);

  const reloadItems = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadItems);
  }, [loadItems, reloadKey]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories, reloadKey]);

  const activeItems = items.filter((item) => item.isActive);

  const monthlyIncomeEstimate = activeItems.reduce(
    (total, item) =>
      item.type === "INCOME"
        ? total + Number(item.amount) * getMonthlyMultiplier(item.frequency)
        : total,
    0,
  );

  const monthlyExpenseEstimate = activeItems.reduce(
    (total, item) =>
      item.type === "EXPENSE"
        ? total + Number(item.amount) * getMonthlyMultiplier(item.frequency)
        : total,
    0,
  );

  function getItemCategory(item: RecurringTransaction) {
    if (item.categoryId) {
      const matchedCategory = categories.find(
        (category) => category.id === item.categoryId,
      );

      if (matchedCategory) {
        return matchedCategory;
      }
    }

    // Fallback untuk respons API yang sudah menyertakan relasi category.
    if (item.category?.id || item.category?.name) {
      return {
        id: item.category.id ?? "",
        name: item.category.name ?? "",
        icon: item.category.icon ?? null,
        color: item.category.color ?? null,
      };
    }

    return null;
  }

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
          <button type="button" onClick={reloadItems} disabled={isLoading}>
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
              <small>Jadwal yang sedang berjalan</small>
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

          {!isLoading && activeItems.length === 0 ? (
            <div className="recurring-empty-state">
              <span aria-hidden="true">↻</span>
              <strong>Belum ada transaksi berulang aktif</strong>
              <p>
                Jadwal pemasukan rutin dan pengeluaran berulang akan ditampilkan
                di sini setelah diaktifkan.
              </p>
            </div>
          ) : (
            !isLoading && (
              <div className="recurring-list">
                <div className="recurring-list-heading">
                  <h3>Jadwal aktif</h3>
                  <span>{activeItems.length} jadwal</span>
                </div>

                <div className="recurring-list-items">
                  {activeItems.map((item) => {
                    const category = getItemCategory(item);

                    const CategoryIcon = category
                      ? (CATEGORY_ICON_MAP[category.icon ?? ""] ?? Tag)
                      : Tag;

                    const categoryColor = getCategoryColor(category?.color);

                    return (
                      <article className="recurring-item" key={item.id}>
                        <div
                          className="recurring-item-symbol"
                          style={
                            categoryColor
                              ? {
                                  color: categoryColor,
                                  backgroundColor: `${categoryColor}14`,
                                }
                              : undefined
                          }
                          aria-hidden="true"
                        >
                          <CategoryIcon size={17} strokeWidth={1.9} />
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
                            {category?.name ? ` · ${category.name}` : ""}
                          </span>

                          <small>
                            Berikutnya: {formatDate(item.nextRunAt)}
                          </small>
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

                          <span className="recurring-status recurring-status--active">
                            Aktif
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
