import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiRequestError, apiClient } from "../lib/api-client";
import "./AccountDetailPage.css";

type AccountType = "CASH" | "BANK" | "E_WALLET" | "CREDIT_CARD" | "OTHER";
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionStatus = "ACTIVE" | "VOIDED";

interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: string | number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string | number;
  currency: string;
  description: string | null;
  transactionDate: string;
  status: TransactionStatus;
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

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Tunai",
  BANK: "Rekening bank",
  E_WALLET: "E-wallet",
  CREDIT_CARD: "Kartu kredit",
  OTHER: "Lainnya",
};

function formatCurrency(amount: string | number, currency = "IDR"): string {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${currency} 0`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return "Akun tidak ditemukan atau tidak dapat diakses.";
    }

    if (error.status === 401) {
      return "Sesi Anda telah berakhir. Silakan masuk kembali.";
    }

    return error.message || "Permintaan gagal diproses.";
  }

  return "Tidak dapat terhubung ke server. Periksa koneksi dan coba kembali.";
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [pageError, setPageError] = useState("");
  const [transactionError, setTransactionError] = useState("");

  const loadAccount = useCallback(async () => {
    if (!id) {
      setPageError("ID akun tidak valid.");
      setLoadingAccount(false);
      return;
    }

    setLoadingAccount(true);
    setPageError("");

    try {
      const result = await apiClient.get<Account>(
        `accounts/${encodeURIComponent(id)}`,
      );
      setAccount(result);
    } catch (error) {
      setPageError(getErrorMessage(error));
      setAccount(null);
    } finally {
      setLoadingAccount(false);
    }
  }, [id]);

  const loadTransactions = useCallback(async () => {
    if (!id) {
      setLoadingTransactions(false);
      return;
    }

    setLoadingTransactions(true);
    setTransactionError("");

    try {
      const query = new URLSearchParams({
        accountId: id,
        page: String(page),
        limit: "10",
      });

      const result = await apiClient.get<TransactionListResponse>(
        `transactions?${query.toString()}`,
      );

      setTransactions(result.data ?? []);
      setTotal(result.meta?.total ?? 0);
      setTotalPages(result.meta?.totalPages ?? 0);
    } catch (error) {
      setTransactionError(getErrorMessage(error));
      setTransactions([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoadingTransactions(false);
    }
  }, [id, page]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const summary = useMemo(() => {
    const activeTransactions = transactions.filter(
      (transaction) => transaction.status === "ACTIVE",
    );

    const income = activeTransactions
      .filter((transaction) => transaction.type === "INCOME")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    const expense = activeTransactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [transactions]);

  if (loadingAccount) {
    return (
      <main className="account-detail-page">
        <div className="account-detail-state" role="status">
          Memuat detail akun…
        </div>
      </main>
    );
  }

  if (pageError || !account) {
    return (
      <main className="account-detail-page">
        <Link className="account-detail-back" to="/accounts">
          ← Kembali ke Accounts
        </Link>
        <section className="account-detail-state account-detail-state-error">
          <h2>Akun tidak dapat ditampilkan</h2>
          <p>{pageError || "Data akun tidak tersedia."}</p>
          <button type="button" onClick={() => void loadAccount()}>
            Coba lagi
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="account-detail-page">
      <div className="account-detail-breadcrumb">
        <Link to="/accounts">Accounts</Link>
        <span>/</span>
        <span>{account.name}</span>
      </div>

      <header className="account-detail-header">
        <div>
          <p className="account-detail-eyebrow">DETAIL AKUN</p>
          <h1>{account.name}</h1>
          <div className="account-detail-meta">
            <span>{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</span>
            <span>{account.currency}</span>
            <span
              className={
                account.isActive
                  ? "account-status-active"
                  : "account-status-inactive"
              }
            >
              {account.isActive ? "Aktif" : "Tidak aktif"}
            </span>
          </div>
        </div>

        <div className="account-detail-actions">
          <Link
            className="account-detail-button account-detail-button-secondary"
            to="/accounts"
          >
            Kembali
          </Link>
          <button
            className="account-detail-button account-detail-button-primary"
            type="button"
            onClick={() =>
              navigate(
                `/transactions/new?accountId=${encodeURIComponent(account.id)}`,
              )
            }
          >
            + Transaksi baru
          </button>
        </div>
      </header>

      <section className="account-detail-opening-balance">
        <div>
          <p>Saldo awal</p>
          <h2>{formatCurrency(account.openingBalance, account.currency)}</h2>
          <span>Ini adalah saldo awal akun, bukan saldo berjalan terkini.</span>
        </div>
        <div className="account-detail-balance-icon" aria-hidden="true">
          ◫
        </div>
      </section>

      <section className="account-detail-summary">
        <article className="account-detail-summary-card">
          <span>Pemasukan di halaman ini</span>
          <strong>{formatCurrency(summary.income, account.currency)}</strong>
          <small>Transaksi aktif pada halaman yang sedang ditampilkan</small>
        </article>
        <article className="account-detail-summary-card">
          <span>Pengeluaran di halaman ini</span>
          <strong>{formatCurrency(summary.expense, account.currency)}</strong>
          <small>Transaksi aktif pada halaman yang sedang ditampilkan</small>
        </article>
        <article className="account-detail-summary-card">
          <span>Selisih di halaman ini</span>
          <strong className={summary.net < 0 ? "account-detail-negative" : ""}>
            {formatCurrency(summary.net, account.currency)}
          </strong>
          <small>Pemasukan dikurangi pengeluaran pada halaman ini</small>
        </article>
      </section>

      <section className="account-detail-transactions">
        <div className="account-detail-section-header">
          <div>
            <h2>Riwayat transaksi</h2>
            <p>{total} transaksi ditemukan untuk akun ini</p>
          </div>
          <button
            type="button"
            className="account-detail-refresh"
            onClick={() => void loadTransactions()}
            disabled={loadingTransactions}
          >
            {loadingTransactions ? "Memuat…" : "↻ Muat ulang"}
          </button>
        </div>

        {transactionError && (
          <div className="account-detail-inline-error" role="alert">
            <p>{transactionError}</p>
            <button type="button" onClick={() => void loadTransactions()}>
              Coba lagi
            </button>
          </div>
        )}

        {loadingTransactions ? (
          <div className="account-detail-empty" role="status">
            Memuat riwayat transaksi…
          </div>
        ) : transactionError ? null : transactions.length === 0 ? (
          <div className="account-detail-empty">
            <span className="account-detail-empty-icon" aria-hidden="true">
              ◷
            </span>
            <h3>Belum ada transaksi</h3>
            <p>Transaksi yang menggunakan akun ini akan muncul di sini.</p>
            <button
              type="button"
              className="account-detail-button account-detail-button-primary"
              onClick={() =>
                navigate(
                  `/transactions/new?accountId=${encodeURIComponent(account.id)}`,
                )
              }
            >
              Buat transaksi pertama
            </button>
          </div>
        ) : (
          <>
            <div className="account-detail-table-wrap">
              <table className="account-detail-table">
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Status</th>
                    <th className="account-detail-amount-heading">Nominal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <strong>
                          {transaction.description?.trim() ||
                            "Transaksi tanpa deskripsi"}
                        </strong>
                        <small>{transaction.id.slice(0, 8)}…</small>
                      </td>
                      <td>{formatDate(transaction.transactionDate)}</td>
                      <td>
                        <span
                          className={`account-detail-type account-detail-type-${transaction.type.toLowerCase()}`}
                        >
                          {transaction.type === "INCOME"
                            ? "Pemasukan"
                            : transaction.type === "EXPENSE"
                              ? "Pengeluaran"
                              : "Transfer"}
                        </span>
                      </td>
                      <td>
                        {transaction.status === "ACTIVE" ? "Aktif" : "Void"}
                      </td>
                      <td
                        className={`account-detail-amount ${transaction.type === "EXPENSE" ? "account-detail-negative" : ""}`}
                      >
                        {transaction.type === "EXPENSE"
                          ? "−"
                          : transaction.type === "INCOME"
                            ? "+"
                            : ""}
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency,
                        )}
                      </td>
                      <td>
                        <Link
                          className="account-detail-view-link"
                          to={`/transactions/${encodeURIComponent(transaction.id)}`}
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="account-detail-pagination">
              <span>
                Halaman {totalPages === 0 ? 0 : page} dari {totalPages}
              </span>
              <div>
                <button
                  type="button"
                  disabled={loadingTransactions || page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={
                    loadingTransactions ||
                    totalPages === 0 ||
                    page >= totalPages
                  }
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
