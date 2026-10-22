import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import "./ReportTransactionsTable.css";

export interface ReportTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  currency: string;
  description: string | null;
  transactionDate: string;
  source: string;
}

export interface ReportTransactionsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ReportTransactionsTableProps {
  transactions: ReportTransaction[];
  meta: ReportTransactionsMeta;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onExport: () => Promise<void>;
}

function formatCurrency(amount: string | number, currency: string): string {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    MANUAL: "Manual",
    TELEGRAM: "Telegram",
    RECURRING: "Berulang",
    TRANSFER: "Transfer",
  };

  return labels[source.toUpperCase()] ?? source;
}

export function ReportTransactionsTable({
  transactions,
  meta,
  isLoading,
  error,
  onPageChange,
  onRetry,
  onExport,
}: ReportTransactionsTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);

    try {
      await onExport();
    } catch {
      setExportError("Gagal mengunduh laporan. Silakan coba kembali.");
    } finally {
      setIsExporting(false);
    }
  }

  const firstItem = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastItem = Math.min(meta.page * meta.limit, meta.total);

  return (
    <section
      className="report-transactions"
      aria-labelledby="report-transactions-title"
    >
      <div className="report-transactions__header">
        <div>
          <span className="report-transactions__eyebrow">DETAIL LAPORAN</span>
          <h2 id="report-transactions-title">Transaksi dalam laporan</h2>
          <p>
            Rincian transaksi berdasarkan filter periode dan tipe yang dipilih.
          </p>
        </div>

        <button
          type="button"
          className="report-transactions__export"
          onClick={handleExport}
          disabled={isExporting || isLoading}
        >
          {isExporting ? (
            <RefreshCw size={17} className="report-transactions__spin" />
          ) : (
            <Download size={17} />
          )}
          {isExporting ? "Mengunduh..." : "Export CSV"}
        </button>
      </div>

      {exportError && (
        <p className="report-transactions__export-error" role="alert">
          {exportError}
        </p>
      )}

      {isLoading ? (
        <div className="report-transactions__state" role="status">
          <RefreshCw size={22} className="report-transactions__spin" />
          <strong>Memuat transaksi laporan...</strong>
          <span>Mohon tunggu sebentar.</span>
        </div>
      ) : error ? (
        <div className="report-transactions__state report-transactions__state--error">
          <strong>Transaksi laporan tidak dapat dimuat</strong>
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            Coba lagi
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="report-transactions__state">
          <FileSpreadsheet size={30} />
          <strong>Belum ada transaksi</strong>
          <span>
            Tidak ada transaksi yang sesuai dengan filter laporan saat ini.
          </span>
        </div>
      ) : (
        <>
          <div className="report-transactions__table-wrapper">
            <table className="report-transactions__table">
              <thead>
                <tr>
                  <th scope="col">Tanggal</th>
                  <th scope="col">Deskripsi</th>
                  <th scope="col">Tipe</th>
                  <th scope="col">Sumber</th>
                  <th scope="col" className="report-transactions__amount">
                    Jumlah
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction) => {
                  const isIncome = transaction.type === "INCOME";

                  return (
                    <tr key={transaction.id}>
                      <td className="report-transactions__date">
                        {formatDate(transaction.transactionDate)}
                      </td>

                      <td className="report-transactions__description">
                        <strong>
                          {transaction.description?.trim() || "Tanpa deskripsi"}
                        </strong>
                        <span>ID: {transaction.id.slice(0, 8)}</span>
                      </td>

                      <td>
                        <span
                          className={`report-transactions__type ${
                            isIncome
                              ? "report-transactions__type--income"
                              : "report-transactions__type--expense"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDown size={14} />
                          ) : (
                            <ArrowUp size={14} />
                          )}
                          {isIncome ? "Pemasukan" : "Pengeluaran"}
                        </span>
                      </td>

                      <td>
                        <span className="report-transactions__source">
                          {formatSource(transaction.source)}
                        </span>
                      </td>

                      <td
                        className={`report-transactions__amount ${
                          isIncome
                            ? "report-transactions__amount--income"
                            : "report-transactions__amount--expense"
                        }`}
                      >
                        {isIncome ? "+" : "−"}
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="report-transactions__footer">
            <span className="report-transactions__count">
              Menampilkan {firstItem}–{lastItem} dari{" "}
              {meta.total.toLocaleString("id-ID")} transaksi
            </span>

            <div className="report-transactions__pagination">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                onClick={() => onPageChange(meta.page - 1)}
                disabled={!meta.hasPreviousPage || isLoading}
              >
                <ChevronLeft size={17} />
              </button>

              <span>
                Halaman {meta.page} dari {Math.max(meta.totalPages, 1)}
              </span>

              <button
                type="button"
                aria-label="Halaman berikutnya"
                onClick={() => onPageChange(meta.page + 1)}
                disabled={!meta.hasNextPage || isLoading}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
