import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./TransactionsPage.css";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  source: string;
  status: string;
  transferGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TransactionListResponse {
  data: Transaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  deletedAt?: string | null;
}

interface CategoryListResponse {
  data: Category[];
}

interface TransactionFilters {
  type: string;
  status: string;
  accountId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 10;

const INITIAL_FILTERS: TransactionFilters = {
  type: "",
  status: "ACTIVE",
  accountId: "",
  categoryId: "",
  startDate: "",
  endDate: "",
};

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Pemasukan",
  EXPENSE: "Pengeluaran",
  TRANSFER: "Transfer",
};

function formatCurrency(value: string | number, currency = "IDR"): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getTypeLabel(type: string): string {
  if (type in TYPE_LABELS) {
    return TYPE_LABELS[type as TransactionType];
  }

  return type;
}

function getTransactionAmountClass(type: TransactionType): string {
  if (type === "INCOME") return "transactions-amount--income";
  if (type === "EXPENSE") return "transactions-amount--expense";
  return "transactions-amount--transfer";
}

function getTransactionAmountPrefix(type: TransactionType): string {
  if (type === "INCOME") return "+";
  if (type === "EXPENSE") return "−";
  return "";
}

function getDateBoundary(date: string, boundary: "start" | "end"): string {
  if (!date) return "";

  const time = boundary === "start" ? "00:00:00" : "23:59:59";
  return `${date}T${time}+07:00`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Coba lagi beberapa saat.";
    }

    return error.message || "Permintaan tidak dapat diproses.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  return "Terjadi kesalahan saat memuat transaksi.";
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<TransactionFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    setOptionsError("");

    try {
      const [accountResponse, categoryResponse] = await Promise.all([
        apiClient.get<Account[]>("accounts"),
        apiClient.get<CategoryListResponse>("categories"),
      ]);

      setAccounts(accountResponse);
      setCategories(categoryResponse.data);
    } catch (loadError) {
      setOptionsError(getErrorMessage(loadError));
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (appliedFilters.type) {
        params.set("type", appliedFilters.type);
      }

      if (appliedFilters.status) {
        params.set("status", appliedFilters.status);
      }

      if (appliedFilters.accountId) {
        params.set("accountId", appliedFilters.accountId);
      }

      if (appliedFilters.categoryId) {
        params.set("categoryId", appliedFilters.categoryId);
      }

      if (appliedFilters.startDate) {
        params.set(
          "startDate",
          getDateBoundary(appliedFilters.startDate, "start"),
        );
      }

      if (appliedFilters.endDate) {
        params.set("endDate", getDateBoundary(appliedFilters.endDate, "end"));
      }

      const response = await apiClient.get<TransactionListResponse>(
        `transactions?${params.toString()}`,
      );

      setTransactions(response.data);
      setMeta(response.meta);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setTransactions([]);
      setMeta({
        page,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOptions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTransactions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTransactions, reloadKey]);

  function updateFilter<K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K],
  ) {
    setFilters((current) => {
      const next = { ...current, [key]: value };

      if (key === "type") {
        next.categoryId = "";
      }

      return next;
    });
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      setError("Tanggal mulai tidak boleh melewati tanggal akhir.");
      return;
    }

    setError("");
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function handleResetFilters() {
    setFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setPage(1);
    setError("");
  }

  function handleRetry() {
    setReloadKey((current) => current + 1);
    void loadOptions();
  }

  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastItem = Math.min(meta.page * meta.limit, meta.total);

  return (
    <section className="transactions-page" aria-labelledby="transactions-title">
      <div className="transactions-page-heading">
        <div>
          <span className="transactions-eyebrow">FINANCIAL ACTIVITY</span>
          <h2 id="transactions-title">Semua transaksi</h2>
          <p>
            Lihat pemasukan, pengeluaran, dan perpindahan dana dalam satu
            tampilan.
          </p>
        </div>

        <div className="transactions-heading-actions">
          <div className="transactions-total-chip">
            <span className="transactions-total-chip__dot" />
            <span>{meta.total.toLocaleString("id-ID")} transaksi</span>
          </div>
        </div>
      </div>

      <section
        className="transactions-overview"
        aria-label="Ringkasan daftar transaksi"
      >
        <article className="transactions-overview-card">
          <span className="transactions-overview-icon transactions-overview-icon--all">
            ↕
          </span>
          <div>
            <span>Total hasil filter</span>
            <strong>{meta.total.toLocaleString("id-ID")}</strong>
            <small>Transaksi sesuai filter aktif</small>
          </div>
        </article>

        <article className="transactions-overview-card">
          <span className="transactions-overview-icon transactions-overview-icon--income">
            ↗
          </span>
          <div>
            <span>Pemasukan di halaman ini</span>
            <strong>
              {formatCurrency(
                transactions
                  .filter((transaction) => transaction.type === "INCOME")
                  .reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0,
                  ),
              )}
            </strong>
            <small>Halaman yang sedang ditampilkan</small>
          </div>
        </article>

        <article className="transactions-overview-card">
          <span className="transactions-overview-icon transactions-overview-icon--expense">
            ↘
          </span>
          <div>
            <span>Pengeluaran di halaman ini</span>
            <strong>
              {formatCurrency(
                transactions
                  .filter((transaction) => transaction.type === "EXPENSE")
                  .reduce(
                    (sum, transaction) => sum + Number(transaction.amount),
                    0,
                  ),
              )}
            </strong>
            <small>Halaman yang sedang ditampilkan</small>
          </div>
        </article>
      </section>

      <section className="transactions-panel">
        <div className="transactions-panel-heading">
          <div>
            <h3>Daftar aktivitas</h3>
            <p>
              Filter transaksi berdasarkan tipe, akun, kategori, atau tanggal.
            </p>
          </div>
          <span className="transactions-panel-heading__icon" aria-hidden="true">
            ☷
          </span>
        </div>

        <form
          className="transactions-filters"
          onSubmit={handleApplyFilters}
          aria-label="Filter transaksi"
        >
          <div className="transactions-filter-field">
            <label htmlFor="transaction-type-filter">Tipe transaksi</label>
            <select
              id="transaction-type-filter"
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value)}
            >
              <option value="">Semua tipe</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>

          <div className="transactions-filter-field">
            <label htmlFor="transaction-status-filter">Status</label>
            <select
              id="transaction-status-filter"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="VOIDED">Dibatalkan</option>
            </select>
          </div>

          <div className="transactions-filter-field">
            <label htmlFor="transaction-account-filter">Akun</label>
            <select
              id="transaction-account-filter"
              value={filters.accountId}
              onChange={(event) =>
                updateFilter("accountId", event.target.value)
              }
              disabled={isLoadingOptions}
            >
              <option value="">Semua akun</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="transactions-filter-field">
            <label htmlFor="transaction-category-filter">Kategori</label>
            <select
              id="transaction-category-filter"
              value={filters.categoryId}
              onChange={(event) =>
                updateFilter("categoryId", event.target.value)
              }
              disabled={isLoadingOptions || filters.type === "TRANSFER"}
            >
              <option value="">Semua kategori</option>
              {categories
                .filter(
                  (category) =>
                    category.isActive &&
                    !category.deletedAt &&
                    (!filters.type ||
                      filters.type === "TRANSFER" ||
                      category.type === filters.type),
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="transactions-filter-field">
            <label htmlFor="transaction-start-date">Dari tanggal</label>
            <input
              id="transaction-start-date"
              type="date"
              value={filters.startDate}
              max={filters.endDate || undefined}
              onChange={(event) =>
                updateFilter("startDate", event.target.value)
              }
            />
          </div>

          <div className="transactions-filter-field">
            <label htmlFor="transaction-end-date">Sampai tanggal</label>
            <input
              id="transaction-end-date"
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </div>

          <div className="transactions-filter-actions">
            <button type="submit" className="transactions-button-primary">
              Terapkan filter
            </button>
            <button
              type="button"
              className="transactions-button-secondary"
              onClick={handleResetFilters}
            >
              Reset
            </button>
          </div>
        </form>

        {optionsError && (
          <div className="transactions-inline-warning" role="alert">
            <span>{optionsError}</span>
            <button type="button" onClick={() => void loadOptions()}>
              Muat ulang opsi
            </button>
          </div>
        )}

        {error && (
          <div className="transactions-error" role="alert">
            <div>
              <strong>Transaksi belum dapat ditampilkan</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="transactions-button-secondary"
              onClick={handleRetry}
            >
              Coba lagi
            </button>
          </div>
        )}

        <div className="transactions-table-meta">
          <span>
            {isLoading
              ? "Memuat transaksi…"
              : meta.total === 0
                ? "Belum ada transaksi yang cocok"
                : `Menampilkan ${firstItem}–${lastItem} dari ${meta.total.toLocaleString("id-ID")} transaksi`}
          </span>
          <span className="transactions-timezone">Waktu Asia/Jakarta</span>
        </div>

        <div className="transactions-table-wrap">
          <table className="transactions-table">
            <thead>
              <tr>
                <th scope="col">Transaksi</th>
                <th scope="col">Akun / kategori</th>
                <th scope="col">Tanggal</th>
                <th scope="col">Sumber</th>
                <th scope="col">Status</th>
                <th scope="col" className="transactions-table-amount">
                  Jumlah
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 5 }, (_, index) => (
                  <tr
                    key={`loading-${index}`}
                    className="transactions-loading-row"
                  >
                    <td colSpan={6}>
                      <span className="transactions-skeleton" />
                    </td>
                  </tr>
                ))}

              {!isLoading &&
                !error &&
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="transactions-description-cell">
                        <span
                          className={`transactions-type-icon transactions-type-icon--${transaction.type.toLowerCase()}`}
                          aria-hidden="true"
                        >
                          {transaction.type === "INCOME"
                            ? "↗"
                            : transaction.type === "EXPENSE"
                              ? "↘"
                              : "⇄"}
                        </span>
                        <div>
                          <strong>
                            {transaction.description?.trim() ||
                              getTypeLabel(transaction.type)}
                          </strong>
                          <span>{getTypeLabel(transaction.type)}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="transactions-account-cell">
                        <strong>
                          {accountNames.get(transaction.accountId) ||
                            "Akun tidak ditemukan"}
                        </strong>
                        <span>
                          {transaction.categoryId
                            ? categoryNames.get(transaction.categoryId) ||
                              "Kategori tidak ditemukan"
                            : transaction.type === "TRANSFER"
                              ? "Transfer antar akun"
                              : "Tanpa kategori"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="transactions-date">
                        {formatDate(transaction.transactionDate)}
                      </span>
                      <span className="transactions-date-time">
                        {formatDateTime(transaction.transactionDate)}
                      </span>
                    </td>

                    <td>
                      <span className="transactions-source">
                        {transaction.source}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`transactions-status transactions-status--${transaction.status.toLowerCase()}`}
                      >
                        <span />
                        {transaction.status === "ACTIVE"
                          ? "Aktif"
                          : transaction.status === "VOIDED"
                            ? "Dibatalkan"
                            : transaction.status}
                      </span>
                    </td>

                    <td className="transactions-table-amount">
                      <strong
                        className={`transactions-amount ${getTransactionAmountClass(transaction.type)}`}
                      >
                        {getTransactionAmountPrefix(transaction.type)}
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency,
                        )}
                      </strong>
                    </td>
                  </tr>
                ))}

              {!isLoading && !error && transactions.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="transactions-empty-state">
                      <span
                        className="transactions-empty-state__icon"
                        aria-hidden="true"
                      >
                        ↕
                      </span>
                      <strong>Belum ada transaksi</strong>
                      <p>
                        Coba ubah filter atau rentang tanggal untuk melihat
                        aktivitas keuangan lainnya.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="transactions-pagination">
          <span>
            Halaman {meta.totalPages === 0 ? 0 : meta.page} dari{" "}
            {meta.totalPages}
          </span>

          <div className="transactions-pagination-actions">
            <button
              type="button"
              className="transactions-button-secondary"
              disabled={isLoading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Sebelumnya
            </button>
            <button
              type="button"
              className="transactions-button-secondary"
              disabled={
                isLoading || meta.totalPages === 0 || page >= meta.totalPages
              }
              onClick={() =>
                setPage((current) => Math.min(meta.totalPages, current + 1))
              }
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
