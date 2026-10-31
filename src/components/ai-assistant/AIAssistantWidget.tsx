import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { ApiRequestError, apiClient } from "../../lib/api-client";
import "./AIAssistantWidget.css";

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
}

const QUICK_PROMPTS = [
  "Analisis pengeluaran saya bulan ini.",
  "Apa kategori pengeluaran terbesar saya?",
  "Bagaimana kondisi anggaran saya?",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir. Silakan login kembali.";
    }

    if (error.status === 403) {
      return "Anda tidak memiliki izin untuk mengakses percakapan ini.";
    }

    if (error.status === 404) {
      return "Percakapan tidak ditemukan. Silakan pilih percakapan lain.";
    }

    if (error.status === 429) {
      return "Permintaan terlalu banyak. Tunggu sebentar lalu coba kembali.";
    }

    if (error.status === 503) {
      return "Layanan AI sedang tidak tersedia. Silakan coba beberapa saat lagi.";
    }

    if (error.status >= 500) {
      return "Terjadi kendala pada layanan. Silakan coba kembali.";
    }

    return error.message || "Permintaan tidak dapat diproses.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke backend. Periksa koneksi Anda.";
  }

  return "Terjadi kesalahan yang tidak terduga. Silakan coba kembali.";
}

function getConversationTitle(conversation: AIConversationSummary): string {
  return conversation.title?.trim() || "Percakapan baru";
}

function formatMessageTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);

  const [conversations, setConversations] = useState<AIConversationSummary[]>(
    [],
  );

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [lastProvider, setLastProvider] = useState("");
  const [lastModel, setLastModel] = useState("");

  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const requestSequenceRef = useRef(0);

  const activeConversation =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ?? null;

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setError("");

    try {
      const result =
        await apiClient.get<AIConversationSummary[]>("ai/conversations");

      const list = Array.isArray(result) ? result : [];

      setConversations(list);
      setHasLoadedConversations(true);

      setActiveConversationId((current) => {
        if (current && list.some((item) => item.id === current)) {
          return current;
        }

        return list[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || hasLoadedConversations) {
      return;
    }

    void loadConversations();
  }, [isOpen, hasLoadedConversations, loadConversations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, activeConversationId]);

  useEffect(() => {
    if (!isOpen || !activeConversationId) {
      if (!activeConversationId) {
        setMessages([]);
      }

      return;
    }

    const sequence = ++requestSequenceRef.current;
    let cancelled = false;

    async function fetchMessages() {
      setIsLoadingMessages(true);
      setError("");

      try {
        const result = await apiClient.get<AIConversationDetail>(
          `ai/conversations/${activeConversationId}`,
        );

        if (cancelled || sequence !== requestSequenceRef.current) {
          return;
        }

        setMessages(Array.isArray(result.messages) ? result.messages : []);
      } catch (loadError) {
        if (cancelled || sequence !== requestSequenceRef.current) {
          return;
        }

        setMessages([]);
        setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled && sequence === requestSequenceRef.current) {
          setIsLoadingMessages(false);
        }
      }
    }

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeConversationId]);

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending, isLoadingMessages]);

  async function createConversation(): Promise<string | null> {
    if (isCreatingConversation) {
      return null;
    }

    setIsCreatingConversation(true);
    setError("");

    try {
      const created = await apiClient.post<AIConversationSummary>(
        "ai/conversations",
        { title: "Percakapan baru" },
      );

      setConversations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);

      setMessages([]);
      setActiveConversationId(created.id);

      return created.id;
    } catch (createError) {
      setError(getErrorMessage(createError));
      return null;
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleNewConversation() {
    if (isSending || isCreatingConversation) {
      return;
    }

    await createConversation();
    inputRef.current?.focus();
  }

  async function handleSendMessage(
    event?: FormEvent<HTMLFormElement>,
    prompt?: string,
  ) {
    event?.preventDefault();

    const content = (prompt ?? draft).trim();

    if (!content || isSending || isCreatingConversation) {
      return;
    }

    setError("");
    setDraft("");
    setIsSending(true);

    let conversationId = activeConversationId;

    try {
      if (!conversationId) {
        conversationId = await createConversation();

        if (!conversationId) {
          setDraft(content);
          return;
        }
      }

      const optimisticMessage: AIMessage = {
        id: `optimistic-${Date.now()}`,
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, optimisticMessage]);

      const result = await apiClient.post<AIChatResponse>(
        `ai/conversations/${conversationId}/messages`,
        { content },
      );

      setActiveConversationId(result.conversationId || conversationId);

      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessage.id),
        result.message,
      ]);

      setLastProvider(result.provider || "");
      setLastModel(result.model || "");

      setConversations((current) => {
        const existing = current.find((item) => item.id === conversationId);

        if (!existing) {
          return current;
        }

        return [
          {
            ...existing,
            updatedAt: new Date().toISOString(),
          },
          ...current.filter((item) => item.id !== conversationId),
        ];
      });
    } catch (sendError) {
      setMessages((current) =>
        current.filter((message) => !message.id.startsWith("optimistic-")),
      );

      setDraft(content);
      setError(getErrorMessage(sendError));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversationId || isDeletingConversation || isSending) {
      return;
    }

    const confirmed = window.confirm(
      "Hapus percakapan ini beserta seluruh pesannya? Tindakan ini tidak dapat dibatalkan.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingConversation(true);
    setError("");

    try {
      await apiClient.delete<{ message: string }>(
        `ai/conversations/${activeConversationId}`,
      );

      const remaining = conversations.filter(
        (item) => item.id !== activeConversationId,
      );

      setConversations(remaining);
      setMessages([]);
      setActiveConversationId(remaining[0]?.id ?? null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeletingConversation(false);
    }
  }

  function handlePromptClick(prompt: string) {
    setDraft(prompt);
    inputRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        className={`ai-widget-launcher${isOpen ? " is-open" : ""}`}
        aria-label={isOpen ? "Tutup AI Assistant" : "Buka AI Assistant"}
        aria-expanded={isOpen}
        aria-controls="ai-assistant-widget-panel"
        title="Tanya AI Assistant"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <X size={23} /> : <Sparkles size={24} />}
        {!isOpen}
      </button>

      {isOpen && (
        <section
          id="ai-assistant-widget-panel"
          ref={panelRef}
          className="ai-widget-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ai-widget-title"
        >
          <header className="ai-widget-header">
            <div className="ai-widget-brand">
              <span className="ai-widget-brand-icon">
                <Sparkles size={19} />
              </span>

              <div>
                <h2 id="ai-widget-title">AI Assistant</h2>
                <p>Asisten keuangan pribadi Anda</p>
              </div>
            </div>

            <div className="ai-widget-header-actions">
              <button
                type="button"
                className="ai-widget-icon-button"
                title="Percakapan baru"
                aria-label="Buat percakapan baru"
                onClick={() => void handleNewConversation()}
                disabled={isCreatingConversation || isSending}
              >
                {isCreatingConversation ? (
                  <LoaderCircle className="ai-widget-spin" size={17} />
                ) : (
                  <Plus size={18} />
                )}
              </button>

              <button
                type="button"
                className="ai-widget-icon-button"
                title="Tutup"
                aria-label="Tutup AI Assistant"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="ai-widget-conversation-bar">
            <label
              className="ai-widget-sr-only"
              htmlFor="ai-widget-conversation"
            >
              Pilih riwayat percakapan
            </label>

            <MessageCircle size={15} aria-hidden="true" />

            <select
              id="ai-widget-conversation"
              value={activeConversationId ?? ""}
              onChange={(event) =>
                setActiveConversationId(event.target.value || null)
              }
              disabled={isLoadingConversations || isSending}
            >
              <option value="">
                {isLoadingConversations
                  ? "Memuat percakapan..."
                  : conversations.length
                    ? "Pilih percakapan"
                    : "Belum ada percakapan"}
              </option>

              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {getConversationTitle(conversation)}
                </option>
              ))}
            </select>

            <ChevronDown
              className="ai-widget-select-chevron"
              size={15}
              aria-hidden="true"
            />

            {activeConversation && (
              <button
                type="button"
                className="ai-widget-delete-button"
                aria-label="Hapus percakapan aktif"
                title="Hapus percakapan"
                onClick={() => void handleDeleteConversation()}
                disabled={isDeletingConversation || isSending}
              >
                {isDeletingConversation ? (
                  <LoaderCircle className="ai-widget-spin" size={15} />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="ai-widget-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button
                type="button"
                aria-label="Tutup pesan error"
                onClick={() => setError("")}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div
            className="ai-widget-messages"
            ref={messageListRef}
            aria-live="polite"
            aria-label="Percakapan dengan AI"
          >
            {isLoadingMessages || isLoadingConversations ? (
              <div className="ai-widget-state">
                <LoaderCircle className="ai-widget-spin" size={22} />
                <span>Menyiapkan percakapan...</span>
              </div>
            ) : messages.filter((message) => message.role !== "SYSTEM")
                .length === 0 ? (
              <div className="ai-widget-welcome">
                <span className="ai-widget-welcome-icon">
                  <Bot size={27} />
                </span>

                <h3>Apa yang ingin Anda ketahui?</h3>

                <p>
                  Saya siap membantu Anda memahami pemasukan, pengeluaran, dan
                  anggaran berdasarkan data keuangan akun Anda.
                </p>

                <div className="ai-widget-prompts">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => handlePromptClick(prompt)}
                      disabled={isSending}
                    >
                      <Sparkles size={14} />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages
                .filter((message) => message.role !== "SYSTEM")
                .map((message) => (
                  <article
                    className={`ai-widget-message ${
                      message.role === "USER" ? "from-user" : "from-ai"
                    }`}
                    key={message.id}
                  >
                    {message.role !== "USER" && (
                      <span className="ai-widget-message-avatar">
                        <Sparkles size={13} />
                      </span>
                    )}

                    <div className="ai-widget-bubble">
                      <div className="ai-widget-message-meta">
                        <strong>
                          {message.role === "USER" ? "Anda" : "AI Assistant"}
                        </strong>
                        <time>{formatMessageTime(message.createdAt)}</time>
                      </div>

                      <p>{message.content}</p>
                    </div>
                  </article>
                ))
            )}

            {isSending && (
              <div className="ai-widget-typing" role="status">
                <LoaderCircle className="ai-widget-spin" size={15} />
                AI sedang menyiapkan jawaban...
              </div>
            )}
          </div>

          {lastProvider && (
            <div className="ai-widget-provider" title={`Model: ${lastModel}`}>
              Provider: {lastProvider}
            </div>
          )}

          <form
            className="ai-widget-composer"
            onSubmit={(event) => void handleSendMessage(event)}
          >
            <label
              className="ai-widget-sr-only"
              htmlFor="ai-widget-message-input"
            >
              Pesan untuk AI Assistant
            </label>

            <textarea
              id="ai-widget-message-input"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tanyakan tentang keuangan Anda..."
              rows={2}
              maxLength={8000}
              disabled={isSending || isCreatingConversation}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />

            <div className="ai-widget-composer-footer">
              <span>Enter untuk kirim · Shift + Enter untuk baris baru</span>

              <button
                type="submit"
                aria-label="Kirim pesan"
                disabled={!draft.trim() || isSending || isCreatingConversation}
              >
                {isSending ? (
                  <LoaderCircle className="ai-widget-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
              </button>
            </div>
          </form>

          <footer className="ai-widget-footer">
            <ShieldCheck size={14} />
            <span>
              Data Anda tetap dilindungi. Periksa kembali saran AI sebelum
              mengambil keputusan keuangan.
            </span>
          </footer>
        </section>
      )}
    </>
  );
}
