import { AlertCircle, MessageCircle, Workflow } from "lucide-react";

import "./IntegrationsPage.css";

const TELEGRAM_BOT_URL = import.meta.env.VITE_TELEGRAM_BOT_URL?.trim() ?? "";

function isValidTelegramBotUrl(value: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (url.hostname === "t.me" || url.hostname === "telegram.me")
    );
  } catch {
    return false;
  }
}

export function IntegrationsPage() {
  const hasBotUrl = isValidTelegramBotUrl(TELEGRAM_BOT_URL);

  return (
    <div className="integrations-page">
      <section className="integrations-intro">
        <div className="integrations-intro-icon" aria-hidden="true">
          <Workflow size={25} />
        </div>

        <div>
          <span className="integrations-eyebrow">WORKSPACE CONNECTIONS</span>

          <h2>Integrations</h2>

          <p>
            Kelola koneksi aplikasi eksternal untuk mendukung pencatatan dan
            pengelolaan keuangan Anda.
          </p>
        </div>
      </section>

      <section
        className="integration-status-grid"
        aria-label="Integrasi yang tersedia"
      >
        <article className="integration-status-card">
          <div className="integration-card-top">
            <span className="integration-product-icon telegram-icon">
              <MessageCircle size={23} />
            </span>

            <span className="integration-status-pill status-unverified">
              <span className="integration-status-dot" />
              Belum diverifikasi
            </span>
          </div>

          <h3>Telegram Bot</h3>

          <p>
            Gunakan Telegram untuk mencatat transaksi melalui percakapan dan
            mengikuti alur konfirmasi yang diproses oleh backend.
          </p>

          <div className="integration-detail-row">
            <span>Status akun</span>
            <strong>Belum tersedia di UI</strong>
          </div>

          <div className="integration-detail-row">
            <span>Status webhook</span>
            <strong>Belum dapat diverifikasi dari UI</strong>
          </div>

          {hasBotUrl ? (
            <a
              className="integration-primary-button"
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Buka Telegram Bot
              <MessageCircle size={16} />
            </a>
          ) : (
            <button
              className="integration-primary-button"
              type="button"
              disabled
              title="Tambahkan VITE_TELEGRAM_BOT_URL ke environment frontend"
            >
              URL bot belum dikonfigurasi
            </button>
          )}

          <div
            className="integration-feedback integration-feedback-error"
            role="note"
          >
            <AlertCircle size={18} />

            <span>
              Pengaitan akun Telegram belum tersedia dari halaman ini. Fitur
              linking akan diaktifkan setelah integrasi backend Telegram
              diselesaikan.
            </span>
          </div>

          <p className="integration-footnote">
            Pastikan URL bot menggunakan alamat resmi Telegram yang sesuai
            dengan konfigurasi backend Anda.
          </p>
        </article>
      </section>
    </div>
  );
}
