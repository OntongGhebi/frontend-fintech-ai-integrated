import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Clipboard,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./IntegrationsPage.css";
import "./IntegrationsPage.ai.css";

const TELEGRAM_BOT_URL = import.meta.env.VITE_TELEGRAM_BOT_URL?.trim() ?? "";

const AI_CAPABILITIES = [
  "Memahami ringkasan keuangan berdasarkan data akun Anda",
  "Menganalisis transaksi, pemasukan, dan pengeluaran",
  "Membantu mengevaluasi anggaran dan kebiasaan belanja",
];

const SAMPLE_PROMPTS = [
  "Bantu saya memahami pengeluaran bulan ini.",
  "Apa kategori pengeluaran terbesar saya?",
  "Berikan saran untuk mengelola anggaran bulanan saya.",
];

interface AIConversationSummary {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AIMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | string;
  content: string;
  model?: string | null;
  createdAt: string;
}

interface AIConversationDetail extends AIConversationSummary {
  messages: AIMessage[];
}

interface AIChatResponse {
  conversationId: string;
  message: AIMessage;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk mengakses integrasi ini.";
    }

    if (error.status === 404) {
      return "Percakapan tidak ditemukan atau sudah dihapus.";
    }

    if (error.status === 429) {
      return "Permintaan terlalu banyak. Tunggu sebentar sebelum mencoba lagi.";
    }

    if (error.status === 503) {
      return "Layanan AI belum aktif atau provider AI sedang tidak tersedia. Periksa konfigurasi AI di environment backend.";
    }

    if (error.status >= 500) {
      return "Backend atau layanan AI sedang mengalami kendala. Silakan coba lagi.";
    }

    return error.message || "Permintaan tidak dapat diproses.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi dan konfigurasi API.";
  }

  if (error instanceof Error) return error.message;

  return "Terjadi kesalahan yang tidak terduga.";
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

function formatMessageTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getConversationTitle(conversation: AIConversationSummary): string {
  return conversation.title?.trim() || "Percakapan baru";
}

export function IntegrationsPage() {
  const [conversations, setConversations] = useState<AIConversationSummary[]>(
    [],
  );

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState("");

  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const [isSending, setIsSending] = useState(false);

  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);

  const [pageError, setPageError] = useState("");
  const [chatError, setChatError] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState("");
  const [lastProvider, setLastProvider] = useState("");
  const [lastModel, setLastModel] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const hasBotUrl = isValidTelegramBotUrl(TELEGRAM_BOT_URL);

  const activeConversation = useMemo(
    () =>
      conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setPageError("");

    try {
      const result =
        await apiClient.get<AIConversationSummary[]>("ai/conversations");

      const list = Array.isArray(result) ? result : [];

      setConversations(list);

      setActiveConversationId((current) => {
        if (current && list.some((item) => item.id === current)) {
          return current;
        }

        return list[0]?.id ?? null;
      });
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, reloadKey]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    setChatError("");

    try {
      const result = await apiClient.get<AIConversationDetail>(
        `ai/conversations/${conversationId}`,
      );

      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (error) {
      setMessages([]);
      setChatError(getErrorMessage(error));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    void loadConversation(activeConversationId);
  }, [activeConversationId, loadConversation]);

  async function handleCreateConversation() {
    if (isCreatingConversation) return;

    setIsCreatingConversation(true);
    setChatError("");

    try {
      const created = await apiClient.post<AIConversationSummary>(
        "ai/conversations",
        { title: "Percakapan baru" },
      );

      setConversations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);

      setActiveConversationId(created.id);
      setMessages([]);
    } catch (error) {
      setChatError(getErrorMessage(error));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || isSending || !activeConversationId) {
      return;
    }

    setIsSending(true);
    setChatError("");
    setDraft("");

    const optimisticMessage: AIMessage = {
      id: `optimistic-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticMessage]);

    try {
      const result = await apiClient.post<AIChatResponse>(
        `ai/conversations/${activeConversationId}/messages`,
        { content },
      );

      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticMessage.id),
        optimisticMessage,
        result.message,
      ]);

      setLastProvider(result.provider);
      setLastModel(result.model);

      setConversations((current) =>
        current
          .map((item) =>
            item.id === activeConversationId
              ? {
                  ...item,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    } catch (error) {
      setMessages((current) =>
        current.filter((item) => item.id !== optimisticMessage.id),
      );

      setDraft(content);
      setChatError(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    if (deletingConversationId) return;

    const confirmed = window.confirm(
      "Hapus percakapan ini beserta seluruh pesan di dalamnya? Tindakan ini tidak dapat dibatalkan.",
    );

    if (!confirmed) return;

    setDeletingConversationId(conversationId);
    setChatError("");

    try {
      await apiClient.delete<{ message: string }>(
        `ai/conversations/${conversationId}`,
      );

      const remaining = conversations.filter(
        (item) => item.id !== conversationId,
      );

      setConversations(remaining);

      if (activeConversationId === conversationId) {
        setActiveConversationId(remaining[0]?.id ?? null);

        setMessages([]);
      }
    } catch (error) {
      setChatError(getErrorMessage(error));
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);

      setCopiedPrompt(prompt);

      window.setTimeout(() => setCopiedPrompt(""), 1800);
    } catch {
      setChatError("Browser tidak mengizinkan akses clipboard.");
    }
  }

  function usePrompt(prompt: string) {
    setDraft(prompt);

    if (!activeConversationId) {
      void handleCreateConversation().then(() => {
        // Draft tetap tersedia untuk percakapan baru.
      });
    }

    document.getElementById("ai-message-input")?.focus();
  }

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
            Hubungkan workflow Telegram dan gunakan AI Assistant untuk memahami
            kondisi keuangan berdasarkan data akun Anda.
          </p>
        </div>
      </section>

      {pageError && (
        <div
          className="integration-feedback integration-feedback-error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{pageError}</span>

          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      )}

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
            <span>Status akun</span>
            <strong>Belum tersedia di API frontend</strong>
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
              title="Tambahkan VITE_TELEGRAM_BOT_URL ke file environment frontend"
            >
              URL bot belum dikonfigurasi
            </button>
          )}

          <p className="integration-footnote">
            Proses linking akun belum diaktifkan dari UI karena endpoint backend
            untuk menyelesaikan dan membaca status linking belum tersedia.
          </p>
        </article>

        <article className="integration-status-card">
          <div className="integration-card-top">
            <span className="integration-product-icon ai-icon">
              <Sparkles size={23} />
            </span>

            <span className="integration-status-pill status-planned">
              API terhubung
            </span>
          </div>

          <h3>AI Assistant</h3>

          <p>
            Percakapan AI menggunakan konteks keuangan akun yang sedang login.
            Riwayat chat disimpan oleh backend.
          </p>

          <div className="integration-detail-row">
            <span>Endpoint percakapan</span>
            <strong>Terhubung</strong>
          </div>

          <div className="integration-detail-row">
            <span>Riwayat percakapan</span>
            <strong>
              {isLoadingConversations
                ? "Memuat..."
                : `${conversations.length} percakapan`}
            </strong>
          </div>

          <button
            className="integration-secondary-button integration-secondary-enabled"
            type="button"
            onClick={() =>
              document
                .getElementById("ai-assistant-panel")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Bot size={17} />
            Buka AI Assistant
          </button>

          <p className="integration-footnote">
            Ketersediaan respons tetap bergantung pada konfigurasi dan kesehatan
            provider AI di backend.
          </p>
        </article>
      </section>

      <section
        className="integration-panel ai-chat-panel"
        id="ai-assistant-panel"
      >
        <div className="integration-section-heading">
          <div className="integration-section-icon ai-heading-icon">
            <Sparkles size={20} />
          </div>

          <div>
            <h3>AI Assistant</h3>

            <p>
              Tanyakan kondisi keuangan Anda berdasarkan data yang tersimpan di
              akun.
            </p>
          </div>

          <button
            type="button"
            className="ai-new-conversation-button"
            onClick={() => void handleCreateConversation()}
            disabled={isCreatingConversation}
          >
            {isCreatingConversation ? (
              <LoaderCircle size={16} className="integration-spin" />
            ) : (
              <Plus size={16} />
            )}
            Percakapan baru
          </button>
        </div>

        {chatError && (
          <div
            className="integration-feedback integration-feedback-error"
            role="alert"
          >
            <AlertCircle size={17} />
            <span>{chatError}</span>
          </div>
        )}

        <div className="ai-chat-layout">
          <aside
            className="ai-conversation-sidebar"
            aria-label="Daftar percakapan"
          >
            <div className="ai-conversation-sidebar-heading">
              <strong>Riwayat percakapan</strong>

              <button
                type="button"
                aria-label="Muat ulang percakapan"
                title="Muat ulang percakapan"
                onClick={() => setReloadKey((value) => value + 1)}
                disabled={isLoadingConversations}
              >
                {isLoadingConversations ? (
                  <LoaderCircle size={15} className="integration-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
              </button>
            </div>

            {isLoadingConversations ? (
              <div className="ai-sidebar-state">Memuat percakapan...</div>
            ) : conversations.length === 0 ? (
              <div className="ai-sidebar-state">
                Belum ada percakapan. Mulai percakapan baru untuk menggunakan
                AI.
              </div>
            ) : (
              <div className="ai-conversation-list">
                {conversations.map((conversation) => (
                  <div
                    className={`ai-conversation-item${
                      conversation.id === activeConversationId
                        ? " is-active"
                        : ""
                    }`}
                    key={conversation.id}
                  >
                    <button
                      type="button"
                      className="ai-conversation-select"
                      onClick={() => setActiveConversationId(conversation.id)}
                    >
                      <span>{getConversationTitle(conversation)}</span>

                      <small>{formatMessageTime(conversation.updatedAt)}</small>
                    </button>

                    <button
                      type="button"
                      className="ai-conversation-delete"
                      aria-label={`Hapus ${getConversationTitle(conversation)}`}
                      title="Hapus percakapan"
                      onClick={() =>
                        void handleDeleteConversation(conversation.id)
                      }
                      disabled={deletingConversationId === conversation.id}
                    >
                      {deletingConversationId === conversation.id ? (
                        <LoaderCircle size={14} className="integration-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div className="ai-chat-main">
            {!activeConversationId ? (
              <div className="ai-chat-empty">
                <span className="ai-chat-empty-icon">
                  <Bot size={27} />
                </span>

                <h4>Mulai percakapan dengan AI</h4>

                <p>
                  Buat percakapan baru untuk mulai bertanya tentang kondisi
                  keuangan Anda.
                </p>

                <button
                  type="button"
                  className="integration-primary-button ai-empty-create-button"
                  onClick={() => void handleCreateConversation()}
                  disabled={isCreatingConversation}
                >
                  <Plus size={16} />
                  Buat percakapan
                </button>
              </div>
            ) : (
              <>
                <div className="ai-chat-header">
                  <div>
                    <strong>
                      {activeConversation
                        ? getConversationTitle(activeConversation)
                        : "Percakapan"}
                    </strong>

                    <span>
                      Jawaban AI berdasarkan konteks keuangan akun Anda
                    </span>
                  </div>

                  {lastProvider && (
                    <span
                      className="ai-provider-label"
                      title={`Model: ${lastModel}`}
                    >
                      {lastProvider}
                    </span>
                  )}
                </div>

                <div
                  className="ai-message-list"
                  aria-live="polite"
                  aria-label="Pesan percakapan"
                >
                  {isLoadingMessages ? (
                    <div className="ai-chat-loading">
                      <LoaderCircle size={21} className="integration-spin" />
                      Memuat pesan...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="ai-chat-welcome">
                      <Sparkles size={23} />

                      <strong>Apa yang ingin Anda ketahui?</strong>

                      <p>
                        Mulai dengan salah satu contoh pertanyaan berikut atau
                        tulis pertanyaan Anda sendiri.
                      </p>
                    </div>
                  ) : (
                    messages
                      .filter((message) => message.role !== "SYSTEM")
                      .map((message) => (
                        <article
                          className={`ai-message ai-message-${message.role.toLowerCase()}`}
                          key={message.id}
                        >
                          <span className="ai-message-avatar">
                            {message.role === "USER" ? (
                              "Anda"
                            ) : (
                              <Sparkles size={15} />
                            )}
                          </span>

                          <div className="ai-message-content">
                            <div className="ai-message-meta">
                              <strong>
                                {message.role === "USER"
                                  ? "Anda"
                                  : "AI Assistant"}
                              </strong>

                              <time>
                                {formatMessageTime(message.createdAt)}
                              </time>
                            </div>

                            <p>{message.content}</p>
                          </div>
                        </article>
                      ))
                  )}

                  {isSending && (
                    <div className="ai-assistant-typing" role="status">
                      <LoaderCircle size={16} className="integration-spin" />
                      AI sedang menyiapkan jawaban...
                    </div>
                  )}
                </div>

                {messages.length === 0 && (
                  <div className="ai-chat-suggestions">
                    {SAMPLE_PROMPTS.map((prompt) => (
                      <button
                        type="button"
                        key={prompt}
                        onClick={() => usePrompt(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  className="ai-chat-composer"
                  onSubmit={(event) => void handleSendMessage(event)}
                >
                  <label className="sr-only" htmlFor="ai-message-input">
                    Pesan untuk AI Assistant
                  </label>

                  <textarea
                    id="ai-message-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Tanyakan sesuatu tentang keuangan Anda..."
                    rows={2}
                    maxLength={8000}
                    disabled={!activeConversationId || isSending}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />

                  <div className="ai-composer-footer">
                    <span>
                      Enter untuk mengirim · Shift + Enter untuk baris baru
                    </span>

                    <button
                      type="submit"
                      disabled={
                        !draft.trim() || isSending || !activeConversationId
                      }
                    >
                      {isSending ? (
                        <LoaderCircle size={16} className="integration-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Kirim
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="integration-security-note">
          <ShieldCheck size={19} />

          <p>
            <strong>Privasi:</strong> percakapan hanya diakses melalui sesi akun
            yang sedang login. Hindari mengirim password, token, atau informasi
            rahasia lainnya. AI dapat keliru; periksa kembali saran sebelum
            mengambil keputusan keuangan.
          </p>
        </div>
      </section>

      <section className="integration-panel ai-preview-panel">
        <div className="integration-section-heading">
          <div className="integration-section-icon ai-heading-icon">
            <Sparkles size={20} />
          </div>

          <div>
            <h3>Kemampuan AI Assistant</h3>

            <p>
              AI menggunakan konteks data finansial akun untuk membantu
              analisis.
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

        <h4 className="sample-prompts-title">Contoh pertanyaan</h4>

        <div className="sample-prompts">
          {SAMPLE_PROMPTS.map((prompt) => (
            <div className="sample-prompt" key={prompt}>
              <p>{prompt}</p>

              <button
                type="button"
                className="copy-prompt-button"
                onClick={() => void copyPrompt(prompt)}
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
      </section>
    </div>
  );
}
