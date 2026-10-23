import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiRequestError, apiClient } from "../lib/api-client";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CirclePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import "./RecurringTransactionsPage.css";

type TransactionType = "INCOME" | "EXPENSE";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

interface Account {
  id: string;
  name: string;
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
interface CategoryResponse {
  data: Category[];
}
interface RecurringTransaction {
  id: string;
  accountId?: string;
  categoryId?: string | null;
  type: TransactionType;
  amount: string | number;
  description: string | null;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  account?: { id?: string; name?: string } | null;
  category?: { id?: string; name?: string } | null;
}
interface RecurringForm {
  type: TransactionType;
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  frequency: Frequency;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: RecurringForm = {
  type: "EXPENSE",
  accountId: "",
  categoryId: "",
  amount: "",
  description: "",
  frequency: "MONTHLY",
  startDate: new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  }),
  endDate: "",
};
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Harian" },
  { value: "WEEKLY", label: "Mingguan" },
  { value: "MONTHLY", label: "Bulanan" },
  { value: "YEARLY", label: "Tahunan" },
];

function currency(value: number | string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
function dateLabel(value?: string | null): string {
  if (!value) return "Belum pernah dijalankan";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tanggal tidak tersedia"
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(date);
}
function errorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0)
      return "Tidak dapat terhubung ke backend. Pastikan API sedang berjalan.";
    if (error.status === 401)
      return "Sesi login berakhir. Silakan login kembali.";
    if (error.status === 400 || error.status === 422)
      return error.message || "Periksa kembali data yang dimasukkan.";
    return error.message || "Permintaan gagal diproses.";
  }
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}
function frequencyLabel(value: Frequency): string {
  return FREQUENCIES.find((item) => item.value === value)?.label ?? value;
}
function parseList(response: unknown): RecurringTransaction[] {
  if (!Array.isArray(response))
    throw new Error(
      "Format respons transaksi berulang tidak sesuai kontrak API.",
    );
  return response.filter((item): item is RecurringTransaction => {
    if (typeof item !== "object" || item === null) return false;
    const value = item as Record<string, unknown>;
    return (
      typeof value.id === "string" &&
      (value.type === "INCOME" || value.type === "EXPENSE") &&
      typeof value.isActive === "boolean" &&
      ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(
        String(value.frequency),
      ) &&
      Number.isFinite(Number(value.amount))
    );
  });
}

export function RecurringTransactionsPage() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringForm>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setPageError("");
    try {
      const [recurringResponse, accountResponse, categoryResponse] =
        await Promise.all([
          apiClient.get<unknown>("recurring-transactions"),
          apiClient.get<Account[]>("accounts"),
          apiClient.get<CategoryResponse>("categories"),
        ]);
      setItems(parseList(recurringResponse));
      setAccounts(
        accountResponse.filter(
          (account) => account.isActive && account.currency === "IDR",
        ),
      );
      setCategories(
        categoryResponse.data.filter(
          (category) => category.isActive && !category.deletedAt,
        ),
      );
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    return items.filter((item) => {
      const matchesText =
        !normalized ||
        `${item.description ?? ""} ${item.account?.name ?? ""} ${item.category?.name ?? ""}`
          .toLocaleLowerCase("id-ID")
          .includes(normalized);
      const matchesType = typeFilter === "ALL" || item.type === typeFilter;
      const matchesActive =
        activeFilter === "ALL" ||
        (activeFilter === "ACTIVE" ? item.isActive : !item.isActive);
      return matchesText && matchesType && matchesActive;
    });
  }, [items, query, typeFilter, activeFilter]);
  const activeItems = items.filter((item) => item.isActive);
  const monthlyFactor = (frequency: Frequency) =>
    frequency === "DAILY"
      ? 30
      : frequency === "WEEKLY"
        ? 52 / 12
        : frequency === "YEARLY"
          ? 1 / 12
          : 1;
  const monthlyIncome = activeItems
    .filter((item) => item.type === "INCOME")
    .reduce(
      (sum, item) => sum + Number(item.amount) * monthlyFactor(item.frequency),
      0,
    );
  const monthlyExpense = activeItems
    .filter((item) => item.type === "EXPENSE")
    .reduce(
      (sum, item) => sum + Number(item.amount) * monthlyFactor(item.frequency),
      0,
    );
  const eligibleCategories = categories.filter(
    (category) => category.type === form.type || category.type === "OTHER",
  );

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      startDate: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      }),
    });
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }
  function openEdit(item: RecurringTransaction) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      accountId: item.accountId ?? item.account?.id ?? "",
      categoryId: item.categoryId ?? item.category?.id ?? "",
      amount: String(item.amount),
      description: item.description ?? "",
      frequency: item.frequency,
      startDate: item.startDate?.slice(0, 10) ?? "",
      endDate: item.endDate?.slice(0, 10) ?? "",
    });
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  }
  function closeForm() {
    if (!isSaving) {
      setIsFormOpen(false);
      setEditingId(null);
      setFormError("");
    }
  }
  function updateForm<K extends keyof RecurringForm>(
    key: K,
    value: RecurringForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    if (!form.accountId)
      return setFormError("Pilih akun untuk jadwal transaksi ini.");
    if (
      !/^\d+(\.\d{1,4})?$/.test(form.amount.trim()) ||
      !Number.isFinite(Number(form.amount)) ||
      Number(form.amount) <= 0
    )
      return setFormError(
        "Nominal harus lebih besar dari 0 dan maksimal 4 angka desimal.",
      );
    if (!form.startDate) return setFormError("Tanggal mulai wajib diisi.");
    if (form.endDate && form.endDate < form.startDate)
      return setFormError("Tanggal akhir tidak boleh sebelum tanggal mulai.");
    setIsSaving(true);
    const payload = {
      accountId: form.accountId,
      categoryId: form.categoryId || null,
      type: form.type,
      amount: form.amount.trim(),
      description: form.description.trim() || null,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
    };
    try {
      if (editingId)
        await apiClient.patch(`recurring-transactions/${editingId}`, payload);
      else await apiClient.post("recurring-transactions", payload);
      setIsFormOpen(false);
      setEditingId(null);
      setSuccessMessage(
        editingId
          ? "Jadwal transaksi berhasil diperbarui."
          : "Jadwal transaksi berhasil dibuat.",
      );
      await loadData();
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(item: RecurringTransaction) {
    setBusyId(item.id);
    setPageError("");
    setSuccessMessage("");
    try {
      await apiClient.patch(`recurring-transactions/${item.id}/enabled`, {
        isActive: !item.isActive,
      });
      setSuccessMessage(
        item.isActive
          ? "Jadwal berhasil dinonaktifkan."
          : "Jadwal berhasil diaktifkan.",
      );
      await loadData();
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setBusyId(null);
    }
  }
  async function deleteItem(item: RecurringTransaction) {
    const label =
      item.description?.trim() ||
      (item.type === "INCOME" ? "pemasukan rutin" : "pengeluaran rutin");
    if (
      !window.confirm(
        `Hapus jadwal “${label}”? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    setBusyId(item.id);
    setPageError("");
    setSuccessMessage("");
    try {
      await apiClient.delete(`recurring-transactions/${item.id}`);
      setSuccessMessage("Jadwal transaksi berhasil dihapus.");
      await loadData();
    } catch (error) {
      setPageError(errorText(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="recurring-page">
      <header className="recurring-page-header">
        <div>
          <span className="recurring-eyebrow">AUTOMATION & PLANNING</span>
          <h1>Recurring transactions</h1>
          <p>
            Atur pemasukan dan pengeluaran rutin agar jadwal keuanganmu tetap
            terpantau.
          </p>
        </div>
        <button
          className="recurring-primary-button"
          type="button"
          onClick={openCreate}
        >
          <CirclePlus size={18} /> Tambah jadwal
        </button>
      </header>

      {pageError && (
        <div className="recurring-alert recurring-alert--error" role="alert">
          <span>{pageError}</span>
          <button type="button" onClick={() => void loadData()}>
            Coba lagi
          </button>
        </div>
      )}
      {successMessage && (
        <div className="recurring-alert recurring-alert--success" role="status">
          {successMessage}
          <button
            type="button"
            aria-label="Tutup pesan"
            onClick={() => setSuccessMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section
        className="recurring-metrics"
        aria-label="Ringkasan transaksi berulang"
        aria-busy={isLoading}
      >
        <article className="recurring-metric">
          <span>Jadwal aktif</span>
          <strong>{isLoading ? "—" : activeItems.length}</strong>
          <small>Dari {items.length} jadwal tersimpan</small>
        </article>
        <article className="recurring-metric recurring-metric--income">
          <span>Estimasi pemasukan / bulan</span>
          <strong>{isLoading ? "—" : currency(monthlyIncome)}</strong>
          <small>Berdasarkan jadwal aktif</small>
        </article>
        <article className="recurring-metric recurring-metric--expense">
          <span>Estimasi pengeluaran / bulan</span>
          <strong>{isLoading ? "—" : currency(monthlyExpense)}</strong>
          <small>Berdasarkan jadwal aktif</small>
        </article>
      </section>

      <section className="recurring-panel">
        <div className="recurring-toolbar">
          <div>
            <h2>Jadwal transaksi</h2>
            <p>Kelola frekuensi, akun, dan status otomatisasi.</p>
          </div>
          <button
            className="recurring-icon-button"
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            aria-label="Muat ulang daftar"
          >
            <RefreshCw
              size={17}
              className={isLoading ? "recurring-spin" : ""}
            />
          </button>
        </div>
        <div className="recurring-filters">
          <label className="recurring-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, akun, atau kategori"
              aria-label="Cari jadwal"
            />
          </label>
          <select
            aria-label="Filter tipe"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "ALL" | TransactionType)
            }
          >
            <option value="ALL">Semua tipe</option>
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
          </select>
          <select
            aria-label="Filter status"
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as ActiveFilter)
            }
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
        {isLoading ? (
          <div className="recurring-loading" role="status">
            Memuat jadwal transaksi…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="recurring-empty">
            <span className="recurring-empty-icon">
              <CalendarClock size={25} />
            </span>
            <h3>
              {items.length === 0
                ? "Belum ada transaksi berulang"
                : "Tidak ada jadwal yang cocok"}
            </h3>
            <p>
              {items.length === 0
                ? "Buat jadwal pertama untuk mengelola pemasukan atau pengeluaran rutin."
                : "Coba ubah kata kunci atau filter yang dipilih."}
            </p>
            {items.length === 0 && (
              <button
                className="recurring-primary-button"
                type="button"
                onClick={openCreate}
              >
                <CirclePlus size={17} /> Buat jadwal pertama
              </button>
            )}
          </div>
        ) : (
          <div className="recurring-table-wrap">
            <table className="recurring-table">
              <thead>
                <tr>
                  <th>Jadwal</th>
                  <th>Akun & kategori</th>
                  <th>Frekuensi</th>
                  <th>Berikutnya</th>
                  <th>Nominal</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="recurring-title-cell">
                        <span
                          className={`recurring-type-icon recurring-type-icon--${item.type.toLowerCase()}`}
                        >
                          {item.type === "INCOME" ? (
                            <ArrowDownRight size={17} />
                          ) : (
                            <ArrowUpRight size={17} />
                          )}
                        </span>
                        <div>
                          <strong>
                            {item.description?.trim() ||
                              (item.type === "INCOME"
                                ? "Pemasukan rutin"
                                : "Pengeluaran rutin")}
                          </strong>
                          <small>
                            {item.type === "INCOME"
                              ? "Pemasukan"
                              : "Pengeluaran"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>
                        {item.account?.name ??
                          accounts.find(
                            (account) => account.id === item.accountId,
                          )?.name ??
                          "Akun"}
                      </strong>
                      <small>
                        {item.category?.name ??
                          categories.find(
                            (category) => category.id === item.categoryId,
                          )?.name ??
                          "Tanpa kategori"}
                      </small>
                    </td>
                    <td>{frequencyLabel(item.frequency)}</td>
                    <td>{dateLabel(item.nextRunAt)}</td>
                    <td>
                      <strong
                        className={
                          item.type === "INCOME"
                            ? "recurring-amount-income"
                            : "recurring-amount-expense"
                        }
                      >
                        {item.type === "INCOME" ? "+" : "−"}
                        {currency(item.amount)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`recurring-status-pill ${item.isActive ? "is-active" : "is-inactive"}`}
                      >
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div className="recurring-row-actions">
                        <button
                          type="button"
                          className="recurring-icon-button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.description || "jadwal"}`}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="recurring-text-action"
                          disabled={busyId === item.id}
                          onClick={() => void toggleActive(item)}
                        >
                          {busyId === item.id
                            ? "…"
                            : item.isActive
                              ? "Nonaktifkan"
                              : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          className="recurring-icon-button recurring-icon-button--danger"
                          disabled={busyId === item.id}
                          onClick={() => void deleteItem(item)}
                          aria-label={`Hapus ${item.description || "jadwal"}`}
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filteredItems.length > 0 && (
          <div className="recurring-list-footer">
            Menampilkan {filteredItems.length} dari {items.length} jadwal
          </div>
        )}
      </section>

      {isFormOpen && (
        <div
          className="recurring-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="recurring-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-form-title"
          >
            <header className="recurring-modal-header">
              <div>
                <span className="recurring-eyebrow">RECURRING SETUP</span>
                <h2 id="recurring-form-title">
                  {editingId
                    ? "Edit jadwal transaksi"
                    : "Buat jadwal transaksi"}
                </h2>
                <p>
                  Jadwal ini akan diproses backend sesuai frekuensi dan
                  tanggalnya.
                </p>
              </div>
              <button
                type="button"
                className="recurring-icon-button"
                onClick={closeForm}
                aria-label="Tutup formulir"
              >
                <X size={19} />
              </button>
            </header>
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="recurring-form"
            >
              <div
                className="recurring-type-switch"
                role="group"
                aria-label="Tipe transaksi"
              >
                <button
                  type="button"
                  className={form.type === "EXPENSE" ? "selected expense" : ""}
                  onClick={() => {
                    updateForm("type", "EXPENSE");
                    updateForm("categoryId", "");
                  }}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  className={form.type === "INCOME" ? "selected income" : ""}
                  onClick={() => {
                    updateForm("type", "INCOME");
                    updateForm("categoryId", "");
                  }}
                >
                  Pemasukan
                </button>
              </div>
              <label>
                Nama / deskripsi{" "}
                <input
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="Contoh: Langganan internet bulanan"
                />
              </label>
              <div className="recurring-form-grid">
                <label>
                  Nominal (IDR)
                  <input
                    required
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) =>
                      updateForm("amount", event.target.value)
                    }
                    placeholder="150000"
                  />
                </label>
                <label>
                  Frekuensi
                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      updateForm("frequency", event.target.value as Frequency)
                    }
                  >
                    {FREQUENCIES.map((frequency) => (
                      <option key={frequency.value} value={frequency.value}>
                        {frequency.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Akun{" "}
                <select
                  required
                  value={form.accountId}
                  onChange={(event) =>
                    updateForm("accountId", event.target.value)
                  }
                >
                  <option value="">Pilih akun</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              {accounts.length === 0 && (
                <p className="recurring-field-hint">
                  Belum ada akun IDR aktif. Tambahkan akun terlebih dahulu di{" "}
                  <Link to="/accounts" onClick={closeForm}>
                    halaman Accounts
                  </Link>
                  .
                </p>
              )}
              <label>
                Kategori (opsional)
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    updateForm("categoryId", event.target.value)
                  }
                >
                  <option value="">Tanpa kategori</option>
                  {eligibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="recurring-form-grid">
                <label>
                  Tanggal mulai
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(event) =>
                      updateForm("startDate", event.target.value)
                    }
                  />
                </label>
                <label>
                  Tanggal akhir (opsional)
                  <input
                    type="date"
                    min={form.startDate || undefined}
                    value={form.endDate}
                    onChange={(event) =>
                      updateForm("endDate", event.target.value)
                    }
                  />
                </label>
              </div>
              {formError && (
                <div
                  className="recurring-alert recurring-alert--error"
                  role="alert"
                >
                  {formError}
                </div>
              )}
              <div className="recurring-modal-actions">
                <button
                  type="button"
                  className="recurring-secondary-button"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="recurring-primary-button"
                  disabled={isSaving || accounts.length === 0}
                >
                  {isSaving
                    ? "Menyimpan…"
                    : editingId
                      ? "Simpan perubahan"
                      : "Buat jadwal"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
