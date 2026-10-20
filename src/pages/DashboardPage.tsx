import { useEffect, useState } from "react";

import { ApiRequestError, apiClient, getApiBaseUrl } from "../lib/api-client";

type DashboardLoadState = "loading" | "success" | "empty" | "error";

interface DashboardRequest {
  startDate: string;
  endDate: string;
}

function toLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): DashboardRequest {
  const end = new Date();
  const start = new Date(end);

  start.setDate(start.getDate() - 29);

  return {
    startDate: toLocalDateInput(start),
    endDate: toLocalDateInput(end),
  };
}

function isNonEmptyObject(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && Object.keys(value).length > 0
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi login tidak lagi berlaku. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Akses ke ringkasan keuangan tidak diizinkan.";
    }

    if (error.status >= 500) {
      return "Server sedang mengalami kendala. Silakan coba kembali.";
    }

    return error.message;
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa server API dan konfigurasi URL.";
  }

  return "Ringkasan dashboard belum dapat dimuat. Silakan coba kembali.";
}

export function DashboardPage() {
  const [dateRange, setDateRange] =
    useState<DashboardRequest>(getDefaultDateRange);

  const [appliedRange, setAppliedRange] =
    useState<DashboardRequest>(getDefaultDateRange);

  const [loadState, setLoadState] = useState<DashboardLoadState>("loading");

  const [errorMessage, setErrorMessage] = useState("");
  const [overview, setOverview] = useState<unknown>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoadState("loading");
      setErrorMessage("");

      const query = new URLSearchParams({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      });

      try {
        const result = await apiClient.get<unknown>(
          `dashboard/overview?${query.toString()}`,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        setOverview(result);
        setLoadState(isNonEmptyObject(result) ? "success" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;

        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [appliedRange, requestVersion]);

  function handleApplyPeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!dateRange.startDate || !dateRange.endDate) {
      setFormError("Tanggal mulai dan tanggal akhir wajib diisi.");
      return;
    }

    if (dateRange.startDate > dateRange.endDate) {
      setFormError("Tanggal mulai tidak boleh setelah tanggal akhir.");
      return;
    }

    setAppliedRange({ ...dateRange });
  }

  function handleRetry() {
    setRequestVersion((version) => version + 1);
  }

  const periodIsApplied =
    dateRange.startDate === appliedRange.startDate &&
    dateRange.endDate === appliedRange.endDate;

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h2>Your financial overview</h2>
          <p>
            Pantau kondisi keuanganmu dari satu tempat. Ringkasan diambil dari
            akun yang sedang login.
          </p>
        </div>

        <span className="dashboard-live-label">
          <span className="dashboard-live-dot" />
          Live API
        </span>
      </div>

      <section className="dashboard-filter-card" aria-label="Filter periode">
        <div className="dashboard-section-title">
          <div>
            <h3>Periode laporan</h3>
            <p>Pilih rentang tanggal untuk memuat ringkasan keuangan.</p>
          </div>

          <span className="filter-calendar-icon" aria-hidden="true">
            ▦
          </span>
        </div>

        <form className="period-filter-form" onSubmit={handleApplyPeriod}>
          <label className="date-field">
            <span>Tanggal mulai</span>
            <input
              type="date"
              value={dateRange.startDate}
              max={dateRange.endDate || undefined}
              onChange={(event) =>
                setDateRange((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="date-field">
            <span>Tanggal akhir</span>
            <input
              type="date"
              value={dateRange.endDate}
              min={dateRange.startDate || undefined}
              onChange={(event) =>
                setDateRange((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
              required
            />
          </label>

          <button
            className="dashboard-primary-button"
            type="submit"
            disabled={loadState === "loading" && periodIsApplied}
          >
            Terapkan periode
          </button>
        </form>

        {formError && (
          <p className="dashboard-inline-error" role="alert">
            {formError}
          </p>
        )}
      </section>

      <section className="dashboard-result-section">
        <div className="dashboard-result-heading">
          <div>
            <h3>Financial overview</h3>
            <p>
              {appliedRange.startDate} — {appliedRange.endDate}
            </p>
          </div>

          <span className={`api-state api-state-${loadState}`}>
            <span className="api-state-dot" />
            {loadState === "loading" && "Memuat data"}
            {loadState === "success" && "Terhubung"}
            {loadState === "empty" && "Belum ada data"}
            {loadState === "error" && "Gagal memuat"}
          </span>
        </div>

        {loadState === "loading" && (
          <div className="dashboard-feedback" role="status" aria-live="polite">
            <span className="dashboard-spinner" aria-hidden="true" />
            <div>
              <strong>Memuat ringkasan keuangan</strong>
              <p>Meminta data dashboard dari backend.</p>
            </div>
          </div>
        )}

        {loadState === "error" && (
          <div
            className="dashboard-feedback dashboard-feedback-error"
            role="alert"
          >
            <span className="feedback-icon" aria-hidden="true">
              !
            </span>
            <div className="feedback-content">
              <strong>Dashboard belum dapat dimuat</strong>
              <p>{errorMessage}</p>
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={handleRetry}
              >
                Coba lagi
              </button>
            </div>
          </div>
        )}

        {loadState === "empty" && (
          <div className="dashboard-feedback">
            <span className="feedback-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <strong>Belum ada ringkasan untuk ditampilkan</strong>
              <p>
                Respons backend kosong. Coba periode lain atau tambahkan
                transaksi terlebih dahulu.
              </p>
            </div>
          </div>
        )}

        {loadState === "success" && (
          <div className="dashboard-feedback dashboard-feedback-success">
            <span className="feedback-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>Data dashboard berhasil dimuat</strong>
              <p>
                Backend mengembalikan ringkasan untuk periode yang dipilih.
                Integrasi berikutnya akan memetakan respons ini ke kartu saldo,
                pemasukan, pengeluaran, grafik, dan anggaran.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-connection-card">
        <div className="connection-card-icon" aria-hidden="true">
          ↗
        </div>

        <div className="connection-card-copy">
          <strong>Koneksi backend</strong>
          <p>
            Request dashboard menggunakan API client bersama sehingga mekanisme
            access token dan refresh session tetap digunakan.
          </p>
          <code>{getApiBaseUrl()}/dashboard/overview</code>
        </div>

        <span className={`connection-status connection-status-${loadState}`}>
          {loadState === "success"
            ? "Request berhasil"
            : loadState === "loading"
              ? "Memproses"
              : loadState === "empty"
                ? "Respons kosong"
                : "Perlu pemeriksaan"}
        </span>
      </section>
    </section>
  );
}
