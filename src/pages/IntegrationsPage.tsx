import { useState } from "react";
import {
  Bot,
  Check,
  Clipboard,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
  AlertCircle,
} from "lucide-react";

import "./IntegrationsPage.css";

const TELEGRAM_BOT_URL = import.meta.env.VITE_TELEGRAM_BOT_URL?.trim() ?? "";

const TELEGRAM_SETUP_STEPS = [
  {
    title: "Siapkan bot Telegram",
    description:
      "Buat bot melalui BotFather dan simpan token bot hanya di environment backend.",
  },
  {
    title: "Konfigurasikan webhook",
    description:
      "Arahkan webhook Telegram ke endpoint backend yang sudah dikonfigurasi. Untuk localhost, backend memerlukan URL publik yang dapat dijangkau Telegram.",
  },
  {
    title: "Verifikasi koneksi",
    description:
      "Kirim pesan pengujian ke bot, lalu periksa log backend untuk memastikan pesan diterima dan diproses.",
  },
];

const AI_CAPABILITIES = [
  "Membantu memahami ringkasan keuangan",
  "Mendukung pencatatan transaksi berbasis bahasa alami",
  "Memberikan konteks untuk evaluasi pengeluaran",
];

const SAMPLE_PROMPTS = [
  "Bantu saya memahami pengeluaran bulan ini",
  "Apa yang perlu saya perhatikan dari kebiasaan belanja saya?",
  "Bantu saya menyusun target anggaran bulanan",
];

export function IntegrationsPage() {
  const [copiedPrompt, setCopiedPrompt] = useState("");

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
      window.setTimeout(() => setCopiedPrompt(""), 1800);
    } catch {
      setCopiedPrompt("");
    }
  }

  const hasBotUrl = isValidTelegramBotUrl(TELEGRAM_BOT_URL);

  return (
    <div className="integrations-page">
      <section className="integrations-intro">
        <div className="integrations-intro-icon" aria-hidden="true">
          <Workflow size={25} />
        </div>
        <div>
          <span className="integrations-eyebrow">WORKSPACE CONNECTIONS</span>
          <h2>Integrasi & AI Assistant</h2>
          <p>
            Siapkan akses Telegram dan lihat rencana kemampuan AI untuk membantu
            mengelola keuangan dengan lebih praktis.
          </p>
        </div>
      </section>

      <section
        className="integration-status-grid"
        aria-label="Status integrasi"
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
            Gunakan Telegram untuk mengirim pesan pencatatan transaksi dan
            mengikuti alur konfirmasi yang diproses backend.
          </p>
          <div className="integration-detail-row">
            <span>Status webhook</span>
            <strong>Belum diperiksa dari UI</strong>
          </div>
          <div className="integration-detail-row">
            <span>Status bot</span>
            <strong>Belum diverifikasi</strong>
          </div>
          {hasBotUrl ? (
            <a
              className="integration-primary-button"
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Buka Telegram Bot
              <ExternalLink size={16} />
            </a>
          ) : (
            <button
              className="integration-primary-button"
              type="button"
              disabled
              title="Tambahkan VITE_TELEGRAM_BOT_URL ke file environment frontend"
            >
              URL bot belum dikonfigurasi
            </button>
          )}
          <p className="integration-footnote">
            Membuka bot tidak dengan sendirinya membuktikan webhook sudah aktif.
          </p>
        </article>

        <article className="integration-status-card">
          <div className="integration-card-top">
            <span className="integration-product-icon ai-icon">
              <Sparkles size={23} />
            </span>
            <span className="integration-status-pill status-planned">
              UI disiapkan
            </span>
          </div>
          <h3>AI Assistant</h3>
          <p>
            Antarmuka percakapan akan membantu memahami data keuangan dan
            menyusun langkah berikutnya berdasarkan informasi akun.
          </p>
          <div className="integration-detail-row">
            <span>Endpoint percakapan</span>
            <strong>Belum terhubung</strong>
          </div>
          <div className="integration-detail-row">
            <span>Konfigurasi AI</span>
            <strong>Menunggu integrasi backend</strong>
          </div>
          <button
            className="integration-secondary-button"
            type="button"
            disabled
          >
            <Bot size={17} />
            Percakapan AI belum tersedia
          </button>
          <p className="integration-footnote">
            Belum ada pesan yang dikirim ke layanan AI dari halaman ini.
          </p>
        </article>
      </section>

      <section className="integration-panel">
        <div className="integration-section-heading">
          <div className="integration-section-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3>Menyiapkan Telegram</h3>
            <p>Checklist konfigurasi untuk pengembangan lokal.</p>
          </div>
        </div>

        <div className="telegram-setup-list">
          {TELEGRAM_SETUP_STEPS.map((step, index) => (
            <div className="telegram-setup-item" key={step.title}>
              <span className="telegram-setup-number">{index + 1}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="integration-security-note">
          <AlertCircle size={19} />
          <p>
            <strong>Keamanan:</strong> jangan menaruh Telegram bot token,
            webhook secret, API key, atau AI provider key di kode frontend.
            Simpan rahasia tersebut di environment backend.
          </p>
        </div>
      </section>

      <section className="integration-panel ai-preview-panel">
        <div className="integration-section-heading">
          <div className="integration-section-icon ai-heading-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>Contoh kebutuhan AI Assistant</h3>
            <p>
              Referensi kebutuhan antarmuka untuk tahap integrasi percakapan
              berikutnya.
            </p>
          </div>
        </div>

        <div className="ai-capabilities">
          {AI_CAPABILITIES.map((capability) => (
            <div className="ai-capability" key={capability}>
              <Check size={16} />
              <span>{capability}</span>
            </div>
          ))}
        </div>

        <h4 className="sample-prompts-title">Contoh prompt</h4>
        <div className="sample-prompts">
          {SAMPLE_PROMPTS.map((prompt) => (
            <div className="sample-prompt" key={prompt}>
              <p>{prompt}</p>
              <button
                type="button"
                className="copy-prompt-button"
                onClick={() => void copyPrompt(prompt)}
                aria-label={`Salin prompt: ${prompt}`}
              >
                {copiedPrompt === prompt ? (
                  <>
                    <Check size={15} />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Clipboard size={15} />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="ai-preview-disclaimer">
          Prompt di atas hanya contoh yang dapat disalin. Fitur ini belum
          mengirim pesan ke AI atau membuat transaksi.
        </p>
      </section>
    </div>
  );
}

function isValidTelegramBotUrl(value: string): boolean {
  if (!value) return false;

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
