import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./AccountsPage.css";

type AccountType = "CASH" | "BANK" | "E_WALLET" | "CREDIT_CARD" | "OTHER";

interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  openingBalance: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountForm {
  name: string;
  type: AccountType;
  openingBalance: string;
}

type FormMode = "create" | "edit";

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "CASH", label: "Tunai" },
  { value: "BANK", label: "Rekening bank" },
  { value: "E_WALLET", label: "Dompet digital" },
  { value: "CREDIT_CARD", label: "Kartu kredit" },
  { value: "OTHER", label: "Lainnya" },
];

const EMPTY_FORM: AccountForm = {
  name: "",
  type: "BANK",
  openingBalance: "0",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function formatCurrency(value: string | number): string {
  const amount = Number(value);

  return Number.isFinite(amount) ? currencyFormatter.format(amount) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function getAccountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      return "Nama akun tersebut sudah digunakan. Gunakan nama yang berbeda.";
    }

    if (error.status === 404) {
      return "Akun tidak ditemukan atau sudah tidak tersedia. Segarkan daftar akun.";
    }

    if (error.status === 400) {
      return `Data akun tidak valid: ${error.message}`;
    }

    if (error.status === 401 || error.status === 403) {
      return "Sesi Anda tidak valid atau tidak memiliki izin untuk melakukan tindakan ini.";
    }

    return error.message || "Permintaan gagal. Silakan coba kembali.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan. Silakan coba kembali.";
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [accountToArchive, setAccountToArchive] = useState<Account | null>(
    null,
  );
  const [archiving, setArchiving] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AccountType>("ALL");

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const result = await apiClient.get<Account[]>("accounts");
      setAccounts(result);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");

    return accounts.filter((account) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        account.name.toLocaleLowerCase("id-ID").includes(normalizedSearch) ||
        getAccountTypeLabel(account.type)
          .toLocaleLowerCase("id-ID")
          .includes(normalizedSearch);

      const matchesType = typeFilter === "ALL" || account.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  const activeOpeningBalance = useMemo(
    () =>
      activeAccounts.reduce(
        (total, account) => total + Number(account.openingBalance || 0),
        0,
      ),
    [activeAccounts],
  );

  const activeAccountTypes = useMemo(
    () => new Set(activeAccounts.map((account) => account.type)).size,
    [activeAccounts],
  );

  function openCreateForm() {
    setFormMode("create");
    setEditingAccountId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPageError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function openEditForm(account: Account) {
    if (!account.isActive) return;

    setFormMode("edit");
    setEditingAccountId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance,
    });
    setFormError("");
    setPageError("");
    setNotice("");
    setIsFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setIsFormOpen(false);
    setFormError("");
    setEditingAccountId(null);
    setForm(EMPTY_FORM);
  }

  function updateField<K extends keyof AccountForm>(
    key: K,
    value: AccountForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setFormError("");

    const name = form.name.trim();

    if (!name) {
      setFormError("Nama akun wajib diisi.");
      return;
    }

    if (name.length > 100) {
      setFormError("Nama akun maksimal 100 karakter.");
      return;
    }

    const normalizedName = name.toLocaleLowerCase("id-ID");

    const duplicate = accounts.some(
      (account) =>
        account.id !== editingAccountId &&
        account.name.trim().toLocaleLowerCase("id-ID") === normalizedName,
    );

    if (duplicate) {
      setFormError("Nama akun sudah digunakan. Pilih nama yang berbeda.");
      return;
    }

    let openingBalance = 0;

    if (formMode === "create") {
      const rawBalance = form.openingBalance.trim();

      if (!rawBalance || !/^\d+(\.\d{1,4})?$/.test(rawBalance)) {
        setFormError(
          "Saldo awal harus berupa angka valid dengan maksimal 4 angka desimal.",
        );
        return;
      }

      openingBalance = Number(rawBalance);

      if (!Number.isFinite(openingBalance) || openingBalance < 0) {
        setFormError("Saldo awal harus berupa angka nol atau lebih.");
        return;
      }
    }

    setSaving(true);

    try {
      if (formMode === "create") {
        const created = await apiClient.post<Account>("accounts", {
          name,
          type: form.type,
          openingBalance,
          currency: "IDR",
        });

        setAccounts((current) => [
          created,
          ...current.filter((account) => account.id !== created.id),
        ]);

        setNotice(`Akun "${created.name}" berhasil dibuat.`);
      } else {
        if (!editingAccountId) {
          setFormError(
            "ID akun tidak ditemukan. Tutup formulir lalu coba kembali.",
          );
          return;
        }

        // Backend hanya mendukung perubahan nama, jenis, dan mata uang.
        // Saldo awal sengaja tidak dikirim pada permintaan PATCH.
        const updated = await apiClient.patch<Account>(
          `accounts/${encodeURIComponent(editingAccountId)}`,
          {
            name,
            type: form.type,
          },
        );

        setAccounts((current) =>
          current.map((account) =>
            account.id === updated.id ? updated : account,
          ),
        );

        setNotice(`Akun "${updated.name}" berhasil diperbarui.`);
      }

      setIsFormOpen(false);
      setEditingAccountId(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!accountToArchive || archiving) return;

    setArchiving(true);
    setPageError("");
    setNotice("");

    try {
      const archivedName = accountToArchive.name;

      await apiClient.delete<{ message: string }>(
        `accounts/${encodeURIComponent(accountToArchive.id)}`,
      );

      setAccountToArchive(null);
      setNotice(`Akun "${archivedName}" berhasil diarsipkan.`);

      // GET /accounts tidak mengembalikan akun yang sudah diarsipkan.
      await loadAccounts();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setArchiving(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter("ALL");
  }

  return (
    <section className="accounts-page">
      <header className="accounts-page-heading">
        <div>
          <p className="accounts-eyebrow">MANAJEMEN KEUANGAN</p>
          <h2>Accounts</h2>
          <p>
            Kelola rekening bank, uang tunai, dompet digital, dan akun keuangan
            lainnya.
          </p>
        </div>

        <button
          type="button"
          className="accounts-button accounts-button-primary"
          onClick={openCreateForm}
        >
          <Plus size={17} aria-hidden="true" />
          Tambah akun
        </button>
      </header>

      {pageError && (
        <div className="accounts-feedback accounts-feedback-error" role="alert">
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            disabled={loading}
          >
            {loading ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      )}

      {notice && (
        <div
          className="accounts-feedback accounts-feedback-success"
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => setNotice("")}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="accounts-summary-grid">
        <article className="accounts-summary-card">
          <span className="accounts-summary-icon accounts-summary-icon-green">
            <Wallet size={19} aria-hidden="true" />
          </span>
          <div>
            <p>Total akun aktif</p>
            <strong>{activeAccounts.length}</strong>
            <span>Rekening yang belum diarsipkan</span>
          </div>
        </article>

        <article className="accounts-summary-card">
          <span className="accounts-summary-icon accounts-summary-icon-lime">
            Rp
          </span>
          <div>
            <p>Total saldo awal</p>
            <strong>{formatCurrency(activeOpeningBalance)}</strong>
            <span>Penjumlahan saldo awal akun aktif</span>
          </div>
        </article>

        <article className="accounts-summary-card">
          <span className="accounts-summary-icon accounts-summary-icon-gray">
            <Wallet size={19} aria-hidden="true" />
          </span>
          <div>
            <p>Jenis akun</p>
            <strong>{activeAccountTypes}</strong>
            <span>Jenis akun yang sedang digunakan</span>
          </div>
        </article>
      </div>

      <section className="accounts-list-card">
        <div className="accounts-list-heading">
          <div>
            <h3>Daftar akun</h3>
            <p>
              {loading
                ? "Sedang memuat akun…"
                : `${filteredAccounts.length} akun ditampilkan`}
            </p>
          </div>

          <button
            type="button"
            className="accounts-button accounts-button-secondary"
            onClick={() => void loadAccounts()}
            disabled={loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {loading ? "Memuat…" : "Segarkan"}
          </button>
        </div>

        <div className="accounts-toolbar">
          <label className="accounts-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau jenis akun"
              aria-label="Cari nama atau jenis akun"
            />
          </label>

          <label className="accounts-filter">
            <span>Jenis akun</span>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as "ALL" | AccountType)
              }
            >
              <option value="ALL">Semua jenis</option>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="accounts-state">
            <span className="accounts-spinner" />
            <strong>Memuat daftar akun…</strong>
            <p>Data sedang diambil dari server.</p>
          </div>
        ) : pageError && accounts.length === 0 ? (
          <div className="accounts-state">
            <strong>Daftar akun belum dapat dimuat</strong>
            <p>Periksa koneksi Anda, kemudian coba muat ulang data akun.</p>
            <button
              type="button"
              className="accounts-button accounts-button-primary"
              onClick={() => void loadAccounts()}
            >
              Coba lagi
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="accounts-state">
            <span className="accounts-empty-icon">
              <Wallet size={24} aria-hidden="true" />
            </span>
            <strong>Belum ada akun keuangan</strong>
            <p>Tambahkan akun pertama untuk mulai mengatur sumber dana Anda.</p>
            <button
              type="button"
              className="accounts-button accounts-button-primary"
              onClick={openCreateForm}
            >
              <Plus size={16} aria-hidden="true" />
              Tambah akun pertama
            </button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="accounts-state">
            <strong>Akun tidak ditemukan</strong>
            <p>Coba ubah kata kunci pencarian atau filter jenis akun.</p>
            <button
              type="button"
              className="accounts-button accounts-button-secondary"
              onClick={resetFilters}
            >
              Reset filter
            </button>
          </div>
        ) : (
          <div className="accounts-table-wrapper">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Nama akun</th>
                  <th>Jenis</th>
                  <th>Saldo awal</th>
                  <th>Status</th>
                  <th>Dibuat pada</th>
                  <th>
                    <span className="accounts-visually-hidden">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="accounts-name-cell">
                        <span
                          className={`accounts-type-icon accounts-type-icon-${account.type.toLowerCase()}`}
                          aria-hidden="true"
                        >
                          {account.type === "CASH"
                            ? "◉"
                            : account.type === "BANK"
                              ? "▤"
                              : account.type === "E_WALLET"
                                ? "▣"
                                : account.type === "CREDIT_CARD"
                                  ? "▱"
                                  : "◈"}
                        </span>
                        <div>
                          <strong>{account.name}</strong>
                          <span>{account.currency}</span>
                        </div>
                      </div>
                    </td>

                    <td>{getAccountTypeLabel(account.type)}</td>

                    <td className="accounts-balance-cell">
                      {formatCurrency(account.openingBalance)}
                    </td>

                    <td>
                      <span
                        className={`accounts-status-pill ${
                          account.isActive
                            ? "accounts-status-active"
                            : "accounts-status-archived"
                        }`}
                      >
                        {account.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>

                    <td>{formatDate(account.createdAt)}</td>

                    <td>
                      <div className="accounts-row-actions">
                        <button
                          type="button"
                          className="accounts-row-action accounts-row-action-icon"
                          aria-label={`Edit akun ${account.name}`}
                          title="Edit akun"
                          onClick={() => openEditForm(account)}
                          disabled={!account.isActive}
                        >
                          <Pencil size={18} strokeWidth={1.8} />
                        </button>

                        {account.isActive && (
                          <button
                            type="button"
                            className="accounts-row-action accounts-row-action-icon accounts-row-action-danger"
                            aria-label={`Arsipkan akun ${account.name}`}
                            title="Arsipkan akun"
                            onClick={() => setAccountToArchive(account)}
                          >
                            <Archive size={18} strokeWidth={1.8} />
                          </button>
                        )}

                        <Link
                          to={`/accounts/${encodeURIComponent(account.id)}`}
                          className="accounts-row-action accounts-row-action-icon accounts-row-action-detail"
                          aria-label={`Lihat detail akun ${account.name}`}
                          title="Lihat detail akun"
                        >
                          <Eye size={18} strokeWidth={1.8} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="accounts-list-footnote">
          Saldo yang ditampilkan adalah saldo awal dari backend, bukan saldo
          berjalan setelah transaksi. Akun yang diarsipkan tidak ditampilkan
          oleh endpoint daftar akun. Pengarsipan tidak menghapus riwayat
          transaksi secara permanen.
        </p>
      </section>

      {isFormOpen && (
        <div
          className="accounts-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeForm();
            }
          }}
        >
          <section
            className="accounts-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="accounts-form-title"
          >
            <header className="accounts-modal-heading">
              <div>
                <p className="accounts-eyebrow">
                  {formMode === "create" ? "AKUN BARU" : "PENGATURAN AKUN"}
                </p>
                <h3 id="accounts-form-title">
                  {formMode === "create" ? "Tambah akun" : "Edit akun"}
                </h3>
                <p>
                  {formMode === "create"
                    ? "Masukkan informasi awal akun keuangan Anda."
                    : "Perbarui nama atau jenis akun. Saldo awal tidak dapat diubah."}
                </p>
              </div>

              <button
                type="button"
                className="accounts-modal-close"
                onClick={closeForm}
                disabled={saving}
                aria-label="Tutup formulir"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <form className="accounts-form" onSubmit={handleSubmit}>
              {formError && (
                <div
                  className="accounts-feedback accounts-feedback-error"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <label className="accounts-form-field">
                <span>Nama akun</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  placeholder="Contoh: BCA Utama"
                />
                <small>{form.name.length}/100 karakter</small>
              </label>

              <label className="accounts-form-field">
                <span>Jenis akun</span>
                <select
                  value={form.type}
                  onChange={(event) =>
                    updateField("type", event.target.value as AccountType)
                  }
                  required
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              {formMode === "create" ? (
                <label className="accounts-form-field">
                  <span>Saldo awal (IDR)</span>
                  <input
                    type="number"
                    min="0"
                    max="999999999999999.9999"
                    step="0.0001"
                    value={form.openingBalance}
                    onChange={(event) =>
                      updateField("openingBalance", event.target.value)
                    }
                    required
                  />
                  <small>
                    Isi 0 jika akun belum memiliki saldo awal. Maksimal 4 angka
                    desimal.
                  </small>
                </label>
              ) : (
                <div className="accounts-readonly-note">
                  Saldo awal tidak dapat diubah setelah akun dibuat.
                </div>
              )}

              <div className="accounts-form-actions">
                <button
                  type="button"
                  className="accounts-button accounts-button-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="accounts-button accounts-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Menyimpan…"
                    : formMode === "create"
                      ? "Buat akun"
                      : "Simpan perubahan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {accountToArchive && (
        <div
          className="accounts-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !archiving) {
              setAccountToArchive(null);
            }
          }}
        >
          <section
            className="accounts-modal accounts-archive-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="accounts-archive-title"
          >
            <span className="accounts-archive-icon" aria-hidden="true">
              <Archive size={21} />
            </span>

            <h3 id="accounts-archive-title">Arsipkan akun ini?</h3>

            <p>
              Akun <strong>{accountToArchive.name}</strong> akan diarsipkan dan
              tidak lagi muncul dalam daftar akun aktif. Pengarsipan bukan
              penghapusan permanen. Pastikan transaksi yang terkait sudah
              dipertimbangkan sebelum melanjutkan.
            </p>

            <div className="accounts-form-actions">
              <button
                type="button"
                className="accounts-button accounts-button-secondary"
                onClick={() => setAccountToArchive(null)}
                disabled={archiving}
              >
                Batal
              </button>

              <button
                type="button"
                className="accounts-button accounts-button-danger"
                onClick={() => void handleArchive()}
                disabled={archiving}
              >
                {archiving ? "Mengarsipkan…" : "Ya, arsipkan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
