import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Wallet,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./TransferFormPage.css";
import "./TransactionDetailPage.css";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  isActive: boolean;
}

interface TransactionResponse {
  id: string;
  accountId: string;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  type: string;
  transferGroupId: string | null;
}

interface TransferResponse {
  transferGroupId: string;
  transactions: TransactionResponse[];
}

interface TransferFormValues {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  transactionDate: string;
  description: string;
}

function getLocalDateTimeValue(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Backend tidak dapat dijangkau. Pastikan server API sedang berjalan.";
    }

    return error.message || "Transfer belum berhasil diproses.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan yang tidak diketahui. Silakan coba kembali.";
}

function toJakartaIsoDateTime(value: string): string {
  // Input datetime-local tidak memiliki informasi zona waktu.
  // Aplikasi ini menggunakan Asia/Jakarta (UTC+07:00).
  return `${value}:00+07:00`;
}

export function TransferFormPage() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(
    null,
  );

  const [form, setForm] = useState<TransferFormValues>({
    sourceAccountId: "",
    destinationAccountId: "",
    amount: "",
    transactionDate: getLocalDateTimeValue(),
    description: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setIsLoadingAccounts(true);
      setAccountsError("");

      try {
        const response = await apiClient.get<Account[]>("/accounts");

        if (cancelled) return;

        const activeAccounts = response.filter(
          (account) => account.isActive && account.currency === "IDR",
        );

        setAccounts(activeAccounts);

        setForm((current) => ({
          ...current,
          sourceAccountId:
            current.sourceAccountId || activeAccounts[0]?.id || "",
          destinationAccountId:
            current.destinationAccountId ||
            activeAccounts.find(
              (account) => account.id !== activeAccounts[0]?.id,
            )?.id ||
            "",
        }));
      } catch (error) {
        if (!cancelled) {
          setAccountsError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAccounts(false);
        }
      }
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === form.sourceAccountId),
    [accounts, form.sourceAccountId],
  );

  const destinationAccount = useMemo(
    () => accounts.find((account) => account.id === form.destinationAccountId),
    [accounts, form.destinationAccountId],
  );

  const amount = Number(form.amount);

  const isAmountValid =
    form.amount.trim() !== "" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    /^\d+(\.\d{1,4})?$/.test(form.amount.trim());

  const sameAccount =
    Boolean(form.sourceAccountId) &&
    form.sourceAccountId === form.destinationAccountId;

  const canSubmit =
    !isLoadingAccounts &&
    !isSubmitting &&
    accounts.length >= 2 &&
    Boolean(form.sourceAccountId) &&
    Boolean(form.destinationAccountId) &&
    !sameAccount &&
    isAmountValid &&
    Boolean(form.transactionDate);

  function updateField<K extends keyof TransferFormValues>(
    field: K,
    value: TransferFormValues[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError("");
    setTransferResult(null);
  }

  function swapAccounts() {
    setForm((current) => ({
      ...current,
      sourceAccountId: current.destinationAccountId,
      destinationAccountId: current.sourceAccountId,
    }));

    setSubmitError("");
    setTransferResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setTransferResult(null);

    if (!form.sourceAccountId || !form.destinationAccountId) {
      setSubmitError("Pilih rekening sumber dan rekening tujuan.");
      return;
    }

    if (sameAccount) {
      setSubmitError("Rekening sumber dan tujuan harus berbeda.");
      return;
    }

    if (!isAmountValid) {
      setSubmitError(
        "Nominal harus lebih besar dari 0 dan maksimal 4 angka desimal.",
      );
      return;
    }

    if (!form.transactionDate) {
      setSubmitError("Tanggal dan waktu transfer wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<TransferResponse>(
        "/transactions/transfer",
        {
          sourceAccountId: form.sourceAccountId,
          destinationAccountId: form.destinationAccountId,
          amount,
          transactionDate: toJakartaIsoDateTime(form.transactionDate),
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
        },
      );

      setTransferResult(response);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (transferResult) {
    return (
      <section className="transfer-page">
        <section className="transfer-success-card" aria-live="polite">
          <div className="transfer-success-icon">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>

          <span className="transfer-eyebrow">TRANSFER BERHASIL</span>

          <h2>Dana berhasil dipindahkan</h2>

          <p className="transfer-success-description">
            Transfer sudah dikirim ke backend. Catatan transaksi sumber dan
            tujuan telah diterima.
          </p>

          <div className="transfer-receipt">
            <div className="transfer-receipt-row">
              <span>Nominal transfer</span>
              <strong>{formatCurrency(amount)}</strong>
            </div>

            <div className="transfer-receipt-row">
              <span>Dari rekening</span>
              <strong>{sourceAccount?.name ?? "Rekening sumber"}</strong>
            </div>

            <div className="transfer-receipt-row">
              <span>Ke rekening</span>
              <strong>{destinationAccount?.name ?? "Rekening tujuan"}</strong>
            </div>

            <div className="transfer-receipt-row">
              <span>Tanggal transfer</span>
              <strong>{formatDateTime(form.transactionDate)}</strong>
            </div>

            <div className="transfer-receipt-row">
              <span>ID grup transfer</span>
              <code>{transferResult.transferGroupId}</code>
            </div>

            <div className="transfer-receipt-row">
              <span>Catatan transaksi</span>
              <strong>{transferResult.transactions.length}</strong>
            </div>
          </div>

          <div className="transfer-success-actions">
            <button
              type="button"
              className="transfer-primary-button"
              onClick={() => navigate("/transactions", { replace: true })}
            >
              Lihat transaksi
            </button>

            <button
              type="button"
              className="transfer-secondary-button"
              onClick={() => {
                setForm((current) => ({
                  ...current,
                  amount: "",
                  description: "",
                  transactionDate: getLocalDateTimeValue(),
                }));

                setTransferResult(null);
              }}
            >
              Transfer lagi
            </button>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="transfer-page">
      <Link
        to="/transactions"
        className="transaction-back-icon-button transaction-back-icon-button--spaced"
        aria-label="Kembali ke daftar transaksi"
        title="Kembali ke daftar transaksi"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>

      <div className="transfer-content-grid">
        <form className="transfer-form-card" onSubmit={handleSubmit} noValidate>
          <div className="transfer-card-heading">
            <div>
              <h3>Detail transfer</h3>
              <p>Lengkapi informasi pemindahan dana berikut.</p>
            </div>

            <span className="transfer-currency-badge">IDR</span>
          </div>

          {accountsError && (
            <div className="transfer-alert transfer-alert-error" role="alert">
              <p>{accountsError}</p>

              <button type="button" onClick={() => window.location.reload()}>
                Muat ulang
              </button>
            </div>
          )}

          {submitError && (
            <div className="transfer-alert transfer-alert-error" role="alert">
              {submitError}
            </div>
          )}

          {isLoadingAccounts ? (
            <div className="transfer-loading" role="status">
              <span className="transfer-spinner" />
              <span>Memuat rekening aktif...</span>
            </div>
          ) : accounts.length < 2 ? (
            <div className="transfer-empty-state">
              <Wallet size={28} aria-hidden="true" />

              <strong>Belum cukup rekening untuk transfer</strong>

              <p>
                Kamu membutuhkan setidaknya dua rekening aktif dengan mata uang
                IDR untuk melakukan transfer.
              </p>

              <Link to="/accounts" className="transfer-secondary-button">
                Buka rekening
              </Link>
            </div>
          ) : (
            <>
              <div className="transfer-account-selector">
                <div className="transfer-field">
                  <label htmlFor="sourceAccountId">Dari rekening</label>

                  <select
                    id="sourceAccountId"
                    value={form.sourceAccountId}
                    onChange={(event) =>
                      updateField("sourceAccountId", event.target.value)
                    }
                    required
                  >
                    <option value="">Pilih rekening sumber</option>

                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.type}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="transfer-swap-button"
                  onClick={swapAccounts}
                  aria-label="Tukar rekening sumber dan tujuan"
                  title="Tukar rekening"
                >
                  <ArrowDownUp size={18} aria-hidden="true" />
                </button>

                <div className="transfer-field">
                  <label htmlFor="destinationAccountId">Ke rekening</label>

                  <select
                    id="destinationAccountId"
                    value={form.destinationAccountId}
                    onChange={(event) =>
                      updateField("destinationAccountId", event.target.value)
                    }
                    required
                  >
                    <option value="">Pilih rekening tujuan</option>

                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {sameAccount && (
                <p className="transfer-field-error" role="alert">
                  Pilih dua rekening yang berbeda.
                </p>
              )}

              <div className="transfer-field transfer-amount-field">
                <label htmlFor="transferAmount">Nominal transfer</label>

                <div className="transfer-amount-input">
                  <span>Rp</span>

                  <input
                    id="transferAmount"
                    type="number"
                    inputMode="decimal"
                    min="0.0001"
                    step="0.0001"
                    max="999999999999999.9999"
                    placeholder="0"
                    value={form.amount}
                    onChange={(event) =>
                      updateField("amount", event.target.value)
                    }
                    required
                  />
                </div>

                {form.amount && !isAmountValid && (
                  <p className="transfer-field-error">
                    Masukkan nominal positif dengan maksimal 4 angka desimal.
                  </p>
                )}
              </div>

              <div className="transfer-field">
                <label htmlFor="transferDate">Tanggal dan waktu</label>

                <input
                  id="transferDate"
                  type="datetime-local"
                  value={form.transactionDate}
                  onChange={(event) =>
                    updateField("transactionDate", event.target.value)
                  }
                  required
                />

                <small>Zona waktu: Asia/Jakarta (WIB).</small>
              </div>

              <div className="transfer-field">
                <label htmlFor="transferDescription">
                  Deskripsi <span>(opsional)</span>
                </label>

                <textarea
                  id="transferDescription"
                  rows={3}
                  maxLength={500}
                  placeholder="Contoh: Memindahkan dana ke tabungan"
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />

                <small>{form.description.length}/500 karakter</small>
              </div>

              <div className="transfer-form-footer">
                <Link to="/transactions" className="transfer-cancel-link">
                  Batal
                </Link>

                <button
                  type="submit"
                  className="transfer-primary-button"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <span className="transfer-button-spinner" />
                      Memproses transfer...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight size={16} aria-hidden="true" />
                      Transfer sekarang
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>

        <aside className="transfer-summary-card">
          <div className="transfer-summary-icon" aria-hidden="true">
            <Wallet size={20} />
          </div>

          <h3>Ringkasan transfer</h3>

          <p>Periksa kembali detail berikut sebelum melanjutkan.</p>

          <div className="transfer-summary-accounts">
            <div className="transfer-summary-account">
              <span className="transfer-summary-dot transfer-summary-dot-source" />

              <div>
                <small>DARI</small>
                <strong>
                  {sourceAccount?.name || "Pilih rekening sumber"}
                </strong>
              </div>
            </div>

            <div className="transfer-summary-connector" aria-hidden="true" />

            <div className="transfer-summary-account">
              <span className="transfer-summary-dot transfer-summary-dot-destination" />

              <div>
                <small>KE</small>
                <strong>
                  {destinationAccount?.name || "Pilih rekening tujuan"}
                </strong>
              </div>
            </div>
          </div>

          <div className="transfer-summary-amount">
            <span>Total yang dipindahkan</span>
            <strong>{formatCurrency(isAmountValid ? amount : 0)}</strong>
          </div>

          <div className="transfer-summary-note">
            <CheckCircle2 size={16} aria-hidden="true" />

            <p>
              Transfer dicatat melalui satu endpoint khusus agar catatan
              rekening sumber dan tujuan terhubung.
            </p>
          </div>

          <div className="transfer-summary-meta">
            <span>Mata uang</span>
            <strong>IDR</strong>
          </div>

          <div className="transfer-summary-meta">
            <span>Biaya transfer</span>
            <strong>Belum ditetapkan</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
