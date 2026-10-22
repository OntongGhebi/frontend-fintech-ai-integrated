import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./TransactionDetailPage.css";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionStatus = "ACTIVE" | "VOIDED";

interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  currency: "IDR";
  description: string | null;
  transactionDate: string;
  source: string;
  status: TransactionStatus;
  transferGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Account {
  id: string;
  name: string;
  currency?: string;
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  isActive?: boolean;
  deletedAt?: string | null;
}

interface AccountsResponse {
  data?: Account[];
}

interface CategoriesResponse {
  data?: Category[];
}

interface EditForm {
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatCurrency(amount: string | number): string {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? currencyFormatter.format(parsed) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 16);
}

function toJakartaIso(value: string): string {
  return `${value}:00+07:00`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Silakan coba kembali.";
}

function getTypeLabel(type: TransactionType): string {
  if (type === "INCOME") return "Pemasukan";
  if (type === "EXPENSE") return "Pengeluaran";
  return "Transfer";
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<EditForm>({
    accountId: "",
    categoryId: "",
    amount: "",
    description: "",
    transactionDate: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const eligibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === transaction?.type &&
          category.isActive !== false &&
          !category.deletedAt,
      ),
    [categories, transaction?.type],
  );

  const loadTransaction = useCallback(async () => {
    await Promise.resolve();

    if (!id) {
      setError("ID transaksi tidak ditemukan pada URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [transactionResult, accountResult, categoryResult] =
        await Promise.all([
          apiClient.get<Transaction>(`transactions/${encodeURIComponent(id)}`),
          apiClient.get<Account[] | AccountsResponse>("accounts"),
          apiClient.get<Category[] | CategoriesResponse>("categories"),
        ]);

      const accountList = Array.isArray(accountResult)
        ? accountResult
        : (accountResult.data ?? []);

      const categoryList = Array.isArray(categoryResult)
        ? categoryResult
        : (categoryResult.data ?? []);

      setTransaction(transactionResult);
      setAccounts(accountList);
      setCategories(categoryList);
      setForm({
        accountId: transactionResult.accountId,
        categoryId: transactionResult.categoryId ?? "",
        amount: transactionResult.amount,
        description: transactionResult.description ?? "",
        transactionDate: toDateTimeLocal(transactionResult.transactionDate),
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadTransaction);
  }, [loadTransaction, reloadKey]);

  const accountName = useMemo(
    () =>
      accounts.find((account) => account.id === transaction?.accountId)?.name ??
      "Akun tidak ditemukan",
    [accounts, transaction?.accountId],
  );

  const categoryName = useMemo(
    () =>
      categories.find((category) => category.id === transaction?.categoryId)
        ?.name ??
      (transaction?.categoryId ? "Kategori tidak ditemukan" : "Tanpa kategori"),
    [categories, transaction?.categoryId],
  );

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transaction || transaction.status !== "ACTIVE") return;

    setError("");
    setNotice("");

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nominal harus berupa angka yang lebih besar dari nol.");
      return;
    }

    if (!form.transactionDate) {
      setError("Tanggal transaksi wajib diisi.");
      return;
    }

    if (!form.accountId) {
      setError("Pilih akun untuk transaksi ini.");
      return;
    }

    if (
      form.categoryId &&
      !eligibleCategories.some((category) => category.id === form.categoryId)
    ) {
      setError("Kategori tidak sesuai dengan jenis transaksi.");
      return;
    }

    const payload = {
      accountId: form.accountId,
      amount,
      description: form.description.trim(),
      transactionDate: toJakartaIso(form.transactionDate),
      ...(transaction.type !== "TRANSFER" && form.categoryId
        ? { categoryId: form.categoryId }
        : {}),
    };

    setSaving(true);

    try {
      const updated = await apiClient.patch<Transaction>(
        `transactions/${encodeURIComponent(transaction.id)}`,
        payload,
      );

      setTransaction(updated);
      setForm({
        accountId: updated.accountId,
        categoryId: updated.categoryId ?? "",
        amount: updated.amount,
        description: updated.description ?? "",
        transactionDate: toDateTimeLocal(updated.transactionDate),
      });
      setIsEditing(false);
      setNotice("Perubahan transaksi berhasil disimpan.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid() {
    if (!transaction || transaction.status !== "ACTIVE") return;

    setVoiding(true);
    setError("");
    setNotice("");

    try {
      await apiClient.delete<{ message: string }>(
        `transactions/${encodeURIComponent(transaction.id)}`,
      );
      setConfirmVoid(false);
      setNotice("Transaksi berhasil di-void.");
      setReloadKey((current) => current + 1);
    } catch (voidError) {
      setError(getErrorMessage(voidError));
    } finally {
      setVoiding(false);
    }
  }

  function cancelEditing() {
    if (!transaction) return;

    setForm({
      accountId: transaction.accountId,
      categoryId: transaction.categoryId ?? "",
      amount: transaction.amount,
      description: transaction.description ?? "",
      transactionDate: toDateTimeLocal(transaction.transactionDate),
    });
    setIsEditing(false);
    setError("");
  }

  if (loading) {
    return (
      <section className="transaction-detail-page">
        <Link className="transaction-back-link" to="/transactions">
          ← Kembali ke transaksi
        </Link>
        <div className="transaction-detail-state">
          <span className="transaction-spinner" />
          <strong>Memuat detail transaksi…</strong>
          <p>Data sedang diambil dari server.</p>
        </div>
      </section>
    );
  }

  if (!transaction) {
    return (
      <section className="transaction-detail-page">
        <Link className="transaction-back-link" to="/transactions">
          ← Kembali ke transaksi
        </Link>
        <div className="transaction-detail-state transaction-detail-state-error">
          <strong>Detail transaksi tidak dapat ditampilkan</strong>
          <p>{error || "Transaksi tidak ditemukan."}</p>
          <button
            className="transaction-button transaction-button-primary"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Coba lagi
          </button>
        </div>
      </section>
    );
  }

  const isActive = transaction.status === "ACTIVE";

  return (
    <section className="transaction-detail-page">
      <Link className="transaction-back-link" to="/transactions">
        ← Kembali ke transaksi
      </Link>

      <header className="transaction-detail-heading">
        <div>
          <p className="transaction-eyebrow">MANAJEMEN KEUANGAN</p>
          <h2>Detail transaksi</h2>
          <p className="transaction-detail-subtitle">
            Periksa informasi dan kelola transaksi yang tercatat.
          </p>
        </div>
        <span
          className={`transaction-status-pill ${
            isActive ? "transaction-status-active" : "transaction-status-voided"
          }`}
        >
          {isActive ? "Aktif" : "Voided"}
        </span>
      </header>

      {error && (
        <div
          className="transaction-feedback transaction-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="transaction-feedback transaction-feedback-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="transaction-detail-amount-card">
        <span>{getTypeLabel(transaction.type)}</span>
        <strong
          className={`transaction-amount-${transaction.type.toLowerCase()}`}
        >
          {transaction.type === "EXPENSE"
            ? "−"
            : transaction.type === "INCOME"
              ? "+"
              : ""}
          {formatCurrency(transaction.amount)}
        </strong>
        <span>{formatDate(transaction.transactionDate)}</span>
      </div>

      <div className="transaction-detail-grid">
        <section className="transaction-detail-card">
          <div className="transaction-detail-card-heading">
            <div>
              <h3>Informasi transaksi</h3>
              <p>Rincian transaksi yang tersimpan di akun Anda.</p>
            </div>
            {!isEditing && isActive && (
              <button
                className="transaction-button transaction-button-secondary"
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setIsEditing(true);
                }}
              >
                Edit transaksi
              </button>
            )}
          </div>

          {isEditing ? (
            <form className="transaction-edit-form" onSubmit={handleSave}>
              <label className="transaction-form-field">
                <span>Akun</span>
                <select
                  required
                  value={form.accountId}
                  onChange={(event) =>
                    updateField("accountId", event.target.value)
                  }
                >
                  <option value="">Pilih akun</option>
                  {accounts
                    .filter((account) => account.isActive !== false)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>

              {transaction.type !== "TRANSFER" && (
                <label className="transaction-form-field">
                  <span>Kategori</span>
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      updateField("categoryId", event.target.value)
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
              )}

              <label className="transaction-form-field">
                <span>Nominal (IDR)</span>
                <input
                  type="number"
                  min="0.0001"
                  max="999999999999999.9999"
                  step="0.0001"
                  required
                  value={form.amount}
                  onChange={(event) =>
                    updateField("amount", event.target.value)
                  }
                />
              </label>

              <label className="transaction-form-field">
                <span>Tanggal dan waktu (WIB)</span>
                <input
                  type="datetime-local"
                  required
                  value={form.transactionDate}
                  onChange={(event) =>
                    updateField("transactionDate", event.target.value)
                  }
                />
              </label>

              <label className="transaction-form-field transaction-form-field-full">
                <span>Deskripsi</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Tambahkan keterangan transaksi"
                />
                <small>{form.description.length}/500 karakter</small>
              </label>

              <div className="transaction-form-actions">
                <button
                  className="transaction-button transaction-button-secondary"
                  type="button"
                  disabled={saving}
                  onClick={cancelEditing}
                >
                  Batal
                </button>
                <button
                  className="transaction-button transaction-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              </div>
            </form>
          ) : (
            <dl className="transaction-detail-list">
              <div>
                <dt>Jenis</dt>
                <dd>{getTypeLabel(transaction.type)}</dd>
              </div>
              <div>
                <dt>Akun</dt>
                <dd>{accountName}</dd>
              </div>
              <div>
                <dt>Kategori</dt>
                <dd>
                  {transaction.type === "TRANSFER"
                    ? "Tidak berlaku"
                    : categoryName}
                </dd>
              </div>
              <div>
                <dt>Deskripsi</dt>
                <dd>{transaction.description || "Tidak ada deskripsi"}</dd>
              </div>
              <div>
                <dt>Sumber</dt>
                <dd>{transaction.source}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{transaction.status}</dd>
              </div>
            </dl>
          )}
        </section>

        <aside className="transaction-detail-card">
          <h3>Metadata</h3>
          <p className="transaction-detail-card-description">
            Identitas dan riwayat perubahan transaksi.
          </p>
          <dl className="transaction-detail-list transaction-metadata-list">
            <div>
              <dt>ID transaksi</dt>
              <dd className="transaction-id-value">{transaction.id}</dd>
            </div>
            <div>
              <dt>Dibuat pada</dt>
              <dd>{formatDate(transaction.createdAt)}</dd>
            </div>
            <div>
              <dt>Terakhir diperbarui</dt>
              <dd>{formatDate(transaction.updatedAt)}</dd>
            </div>
            {transaction.transferGroupId && (
              <div>
                <dt>Transfer group ID</dt>
                <dd className="transaction-id-value">
                  {transaction.transferGroupId}
                </dd>
              </div>
            )}
          </dl>

          {isActive && (
            <div className="transaction-danger-zone">
              <h4>Zona berisiko</h4>
              <p>
                Void transaksi akan mengubah statusnya. Tindakan ini tidak
                menghapus catatan secara permanen dan tidak dapat diulang dari
                halaman ini setelah berhasil.
              </p>
              <button
                className="transaction-button transaction-button-danger"
                type="button"
                onClick={() => setConfirmVoid(true)}
              >
                Void transaksi
              </button>
            </div>
          )}
        </aside>
      </div>

      {confirmVoid && (
        <div
          className="transaction-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !voiding) {
              setConfirmVoid(false);
            }
          }}
        >
          <section
            className="transaction-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-transaction-title"
          >
            <div className="transaction-modal-icon">!</div>
            <h3 id="void-transaction-title">Void transaksi ini?</h3>
            <p>
              Anda akan mengubah status transaksi senilai{" "}
              <strong>{formatCurrency(transaction.amount)}</strong> menjadi
              VOIDED. Pastikan Anda memilih transaksi yang benar.
            </p>
            <div className="transaction-modal-actions">
              <button
                className="transaction-button transaction-button-secondary"
                type="button"
                disabled={voiding}
                onClick={() => setConfirmVoid(false)}
              >
                Batal
              </button>
              <button
                className="transaction-button transaction-button-danger"
                type="button"
                disabled={voiding}
                onClick={() => void handleVoid()}
              >
                {voiding ? "Memproses…" : "Ya, void transaksi"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
