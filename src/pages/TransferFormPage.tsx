import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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

interface AccountBalanceResponse {
  accountId: string;
  balance: string;
  currency: string;
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

const MAX_TRANSFER_AMOUNT = 999999999999999.875;
const TRANSFER_AMOUNT_PATTERN = /^\d+(\.\d{1,4})?$/;
const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function getJakartaDateTimeValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function isValidJakartaDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = (timePart ?? "").split(":").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    hour === undefined ||
    minute === undefined ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return false;
  }

  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
  );
}

function toJakartaIsoDateTime(value: string): string {
  if (!isValidJakartaDateTime(value)) {
    throw new Error("Tanggal dan waktu transfer tidak valid.");
  }

  return `${value}:00+07:00`;
}

function toAmountUnits(value: string | number): bigint | null {
  const normalized = String(value).trim();

  if (!/^-?\d+(\.\d{1,4})?$/.test(normalized)) {
    return null;
  }

  const isNegative = normalized.startsWith("-");
  const unsignedValue = isNegative ? normalized.slice(1) : normalized;
  const [wholePart, fractionPart = ""] = unsignedValue.split(".");
  const units =
    BigInt(wholePart || "0") * 10000n +
    BigInt((fractionPart + "0000").slice(0, 4));

  return isNegative ? -units : units;
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDateTime(value: string): string {
  const date = isValidJakartaDateTime(value)
    ? new Date(toJakartaIsoDateTime(value))
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Backend tidak dapat dijangkau. Pastikan server API sedang berjalan.";
    }

    if (error.status === 400 || error.status === 422) {
      return `Data transfer tidak valid: ${error.message}`;
    }

    if (error.status === 401) {
      return "Sesi Anda telah berakhir. Silakan masuk kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk menggunakan salah satu rekening tersebut.";
    }

    if (error.status === 404) {
      return "Rekening sumber atau tujuan tidak ditemukan. Segarkan halaman dan coba kembali.";
    }

    if (error.status === 409) {
      return "Transfer tidak dapat diproses karena kondisi rekening berubah. Periksa kembali rekening Anda.";
    }

    return error.message || "Transfer belum berhasil diproses.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan yang tidak diketahui. Silakan coba kembali.";
}

export function TransferFormPage() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [sourceBalance, setSourceBalance] = useState<string | null>(null);
  const [isLoadingSourceBalance, setIsLoadingSourceBalance] = useState(false);
  const [sourceBalanceError, setSourceBalanceError] = useState("");
  const [sourceBalanceReloadKey, setSourceBalanceReloadKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isTransferOutcomeUncertain, setIsTransferOutcomeUncertain] =
    useState(false);
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(
    null,
  );

  const [form, setForm] = useState<TransferFormValues>({
    sourceAccountId: "",
    destinationAccountId: "",
    amount: "",
    transactionDate: getJakartaDateTimeValue(),
    description: "",
  });

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setAccountsError("");

    try {
      const response = await apiClient.get<Account[]>("accounts");
      const activeAccounts = response.filter(
        (account) => account.isActive && account.currency === "IDR",
      );

      setAccounts(activeAccounts);
      setForm((current) => {
        const sourceStillAvailable = activeAccounts.some(
          (account) => account.id === current.sourceAccountId,
        );
        const destinationStillAvailable = activeAccounts.some(
          (account) => account.id === current.destinationAccountId,
        );
        const sourceAccountId = sourceStillAvailable
          ? current.sourceAccountId
          : (activeAccounts[0]?.id ?? "");
        const destinationAccountId = destinationStillAvailable
          ? current.destinationAccountId
          : (activeAccounts.find((account) => account.id !== sourceAccountId)
              ?.id ?? "");

        return {
          ...current,
          sourceAccountId,
          destinationAccountId,
        };
      });
    } catch (error) {
      setAccountsError(getErrorMessage(error));
      setAccounts([]);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === form.sourceAccountId),
    [accounts, form.sourceAccountId],
  );

  const destinationAccount = useMemo(
    () => accounts.find((account) => account.id === form.destinationAccountId),
    [accounts, form.destinationAccountId],
  );

  useEffect(() => {
    if (!sourceAccount?.id || !sourceAccount.isActive) {
      setSourceBalance(null);
      setSourceBalanceError("");
      setIsLoadingSourceBalance(false);
      return;
    }

    let cancelled = false;

    async function loadBalance() {
      setIsLoadingSourceBalance(true);
      setSourceBalance(null);
      setSourceBalanceError("");

      try {
        const result = await apiClient.get<AccountBalanceResponse>(
          `accounts/${encodeURIComponent(sourceAccount.id)}/balance`,
        );

        if (cancelled) return;

        if (
          result.accountId !== sourceAccount.id ||
          result.currency !== "IDR" ||
          !Number.isFinite(Number(result.balance))
        ) {
          throw new Error("Saldo rekening sumber tidak dapat diverifikasi.");
        }

        setSourceBalance(result.balance);
      } catch (error) {
        if (!cancelled) {
          setSourceBalanceError(getErrorMessage(error));
          setSourceBalance(null);
        }
      } finally {
        if (!cancelled) setIsLoadingSourceBalance(false);
      }
    }

    void loadBalance();

    return () => {
      cancelled = true;
    };
  }, [sourceAccount?.id, sourceAccount?.isActive, sourceBalanceReloadKey]);

  const availableBalanceUnits =
    sourceBalance === null ? null : toAmountUnits(sourceBalance);
  const hasAvailableBalance =
    availableBalanceUnits !== null && availableBalanceUnits > 0n;

  const amount = Number(form.amount);
  const isAmountValid =
    form.amount.trim() !== "" &&
    TRANSFER_AMOUNT_PATTERN.test(form.amount.trim()) &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= MAX_TRANSFER_AMOUNT;
  const amountUnits = isAmountValid ? toAmountUnits(form.amount.trim()) : null;

  const sameAccount =
    Boolean(form.sourceAccountId) &&
    form.sourceAccountId === form.destinationAccountId;

  const isDateValid = isValidJakartaDateTime(form.transactionDate);

  const canSubmit =
    !isLoadingAccounts &&
    !isSubmitting &&
    !isTransferOutcomeUncertain &&
    accounts.length >= 2 &&
    Boolean(sourceAccount?.isActive && sourceAccount.currency === "IDR") &&
    Boolean(
      destinationAccount?.isActive && destinationAccount.currency === "IDR",
    ) &&
    !sameAccount &&
    !isLoadingSourceBalance &&
    !sourceBalanceError &&
    hasAvailableBalance &&
    isAmountValid &&
    amountUnits !== null &&
    availableBalanceUnits !== null &&
    amountUnits <= availableBalanceUnits &&
    isDateValid;

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

    if (isSubmitting) return;

    setSubmitError("");
    setTransferResult(null);

    if (!sourceAccount || !destinationAccount) {
      setSubmitError("Pilih rekening sumber dan rekening tujuan yang aktif.");
      return;
    }

    if (sameAccount) {
      setSubmitError("Rekening sumber dan tujuan harus berbeda.");
      return;
    }

    if (
      isLoadingSourceBalance ||
      sourceBalance === null ||
      sourceBalanceError
    ) {
      setSubmitError(
        "Saldo rekening sumber belum dapat diverifikasi. Muat ulang saldo sebelum melakukan transfer.",
      );
      return;
    }

    const verifiedAvailableBalance = toAmountUnits(sourceBalance);

    if (verifiedAvailableBalance === null || verifiedAvailableBalance <= 0n) {
      setSubmitError(
        "Saldo rekening sumber Rp0 atau negatif. Rekening ini tidak dapat digunakan untuk transfer.",
      );
      return;
    }

    if (!isAmountValid) {
      setSubmitError(
        "Nominal harus lebih besar dari 0, tidak melebihi batas maksimum, dan maksimal 4 angka desimal.",
      );
      return;
    }

    const requestedAmountUnits = toAmountUnits(form.amount.trim());

    if (
      requestedAmountUnits === null ||
      requestedAmountUnits > verifiedAvailableBalance
    ) {
      setSubmitError(
        `Nominal transfer melebihi saldo tersedia (${formatCurrency(sourceBalance)}). Kurangi nominal transfer.`,
      );
      return;
    }

    if (!isDateValid) {
      setSubmitError("Tanggal dan waktu transfer tidak valid.");
      return;
    }

    if (form.description.length > 500) {
      setSubmitError("Deskripsi maksimal 500 karakter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<TransferResponse>(
        "transactions/transfer",
        {
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          amount,
          transactionDate: toJakartaIsoDateTime(form.transactionDate),
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
        },
      );

      if (
        !response ||
        typeof response.transferGroupId !== "string" ||
        !Array.isArray(response.transactions) ||
        response.transactions.length !== 2
      ) {
        setIsTransferOutcomeUncertain(true);
        setSubmitError(
          "Permintaan transfer mendapat respons yang tidak lengkap. Jangan kirim ulang dulu karena transfer mungkin sudah diproses. Periksa daftar transaksi untuk memastikan hasilnya.",
        );
        return;
      }

      setTransferResult(response);
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof ApiRequestError &&
          (error.status === 0 || error.status >= 500))
      ) {
        setIsTransferOutcomeUncertain(true);
        setSubmitError(
          "Koneksi atau server terputus saat memproses transfer. Hasil transaksi belum dapat dipastikan. Jangan kirim ulang dulu; periksa daftar transaksi untuk menghindari transfer ganda.",
        );
      } else {
        setSubmitError(getErrorMessage(error));
      }
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
            Backend telah mengembalikan dua catatan transaksi yang terhubung
            dalam satu grup transfer.
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
              <strong>{transferResult.transactions.length} transaksi</strong>
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
                  transactionDate: getJakartaDateTimeValue(),
                }));
                setTransferResult(null);
                setSubmitError("");
                setSourceBalanceReloadKey((current) => current + 1);
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
              <button
                type="button"
                onClick={() => void loadAccounts()}
                disabled={isLoadingAccounts}
              >
                {isLoadingAccounts ? "Memuat…" : "Coba lagi"}
              </button>
            </div>
          )}

          {submitError && (
            <div className="transfer-alert transfer-alert-error" role="alert">
              <p>{submitError}</p>
              {isTransferOutcomeUncertain && (
                <button type="button" onClick={() => navigate("/transactions")}>
                  Periksa daftar transaksi
                </button>
              )}
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

              {/* Informasi saldo dipindahkan ke bawah baris dropdown agar
                  kedua field rekening selalu sejajar. */}
              <div
                className="transfer-source-balance"
                aria-live="polite"
                style={{
                  display: "block",
                  marginTop: "8px",
                  marginBottom: "16px",
                  fontSize: "0.8125rem",
                  lineHeight: 1.5,
                }}
              >
                {sourceAccount ? (
                  isLoadingSourceBalance ? (
                    <small>Memuat saldo tersedia...</small>
                  ) : sourceBalanceError ? (
                    <small>{sourceBalanceError}</small>
                  ) : sourceBalance !== null ? (
                    <small>
                      Saldo tersedia: {formatCurrency(sourceBalance)}
                    </small>
                  ) : (
                    <small>Saldo tersedia belum diketahui.</small>
                  )
                ) : (
                  <small>
                    Pilih rekening sumber untuk melihat saldo tersedia.
                  </small>
                )}
              </div>

              {sameAccount && (
                <p className="transfer-field-error" role="alert">
                  Pilih dua rekening yang berbeda.
                </p>
              )}

              {availableBalanceUnits !== null &&
                availableBalanceUnits <= 0n && (
                  <div
                    className="transfer-alert transfer-alert-error"
                    role="alert"
                  >
                    Saldo rekening sumber tidak tersedia (Rp0 atau negatif).
                    Pilih rekening lain yang memiliki saldo tersedia.
                  </div>
                )}

              {isAmountValid &&
                amountUnits !== null &&
                availableBalanceUnits !== null &&
                amountUnits > availableBalanceUnits && (
                  <p className="transfer-field-error" role="alert">
                    Nominal transfer melebihi saldo tersedia sebesar{" "}
                    {formatCurrency(sourceBalance ?? "0")}.
                  </p>
                )}

              {sourceBalanceError && (
                <div
                  className="transfer-alert transfer-alert-error"
                  role="alert"
                >
                  <p>{sourceBalanceError}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setSourceBalanceReloadKey((current) => current + 1)
                    }
                  >
                    Muat ulang saldo dengan memilih ulang rekening sumber
                  </button>
                </div>
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
                    max={MAX_TRANSFER_AMOUNT}
                    step="0.0001"
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
                    Masukkan nominal positif, maksimal 4 angka desimal, dan
                    tidak melebihi batas nominal backend.
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
                {!isDateValid && form.transactionDate && (
                  <small className="transfer-field-error">
                    Masukkan tanggal dan waktu yang valid.
                  </small>
                )}
                <small>Zona waktu: Asia/Jakarta (UTC+07:00).</small>
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
