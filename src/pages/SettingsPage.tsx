import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  MonitorSmartphone,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { ApiRequestError, clearAuthTokens } from "../lib/api-client";
import {
  usersApi,
  type UserPreferences,
  type UserProfile,
  type UserSession,
} from "../lib/users-api";
import "./SettingsPage.css";

type SettingsTab = "profile" | "preferences" | "security";

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

const DEFAULT_PREFERENCES: UserPreferences = {
  currency: "IDR",
  timezone: "Asia/Jakarta",
  locale: "id-ID",
  weekStartsOn: 1,
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sesi Anda berakhir atau data autentikasi tidak valid. Silakan masuk kembali.";
    }

    if (error.status === 409) {
      return (
        error.message ||
        "Data tersebut sudah digunakan atau tidak dapat diproses."
      );
    }

    if (error.status === 400) {
      return error.message || "Data yang dikirim belum valid.";
    }

    if (error.status === 404) {
      return error.message || "Data yang diminta tidak ditemukan.";
    }

    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Belum tersedia";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Belum tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function describeSession(session: UserSession): string {
  const agent = session.userAgent?.trim();

  if (!agent) return "Perangkat atau browser tidak diketahui";
  if (/windows/i.test(agent)) return "Browser di Windows";
  if (/android/i.test(agent)) return "Perangkat Android";
  if (/iphone|ipad|ios/i.test(agent)) return "Perangkat Apple";
  if (/macintosh|mac os/i.test(agent)) return "Browser di macOS";
  if (/linux/i.test(agent)) return "Browser di Linux";

  return agent.length > 100 ? `${agent.slice(0, 97)}...` : agent;
}

export function SettingsPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [sessions, setSessions] = useState<UserSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const [loadedProfile, loadedPreferences, loadedSessions] =
        await Promise.all([
          usersApi.getProfile(),
          usersApi.getPreferences(),
          usersApi.getSessions(),
        ]);

      setProfile(loadedProfile);
      setProfileForm({
        name: loadedProfile.name ?? "",
        email: loadedProfile.email ?? "",
      });
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...loadedPreferences,
      });
      setSessions(loadedSessions.filter((session) => !session.revokedAt));
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          "Pengaturan akun gagal dimuat. Silakan coba kembali.",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = profileForm.name.trim();
    const email = profileForm.email.trim().toLowerCase();

    if (name.length < 2 || name.length > 100) {
      setNotice({
        type: "error",
        message: "Nama harus terdiri dari 2 sampai 100 karakter.",
      });
      return;
    }

    if (!email) {
      setNotice({
        type: "error",
        message: "Email wajib diisi.",
      });
      return;
    }

    setSavingProfile(true);
    setNotice(null);

    try {
      const updated = await usersApi.updateProfile({ name, email });

      setProfile(updated);
      setProfileForm({
        name: updated.name,
        email: updated.email,
      });

      await refreshUser();

      setNotice({
        type: "success",
        message:
          updated.email !== profile?.email
            ? "Profil diperbarui. Perubahan email memerlukan verifikasi ulang jika alamat email berubah."
            : "Profil berhasil diperbarui.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, "Profil gagal diperbarui."),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePreferencesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSavingPreferences(true);
    setNotice(null);

    try {
      const updated = await usersApi.updatePreferences(preferences);

      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...updated,
      });

      setNotice({
        type: "success",
        message: "Preferensi berhasil disimpan.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, "Preferensi gagal disimpan."),
      });
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (
      passwordForm.currentPassword.length < 8 ||
      passwordForm.currentPassword.length > 128
    ) {
      setNotice({
        type: "error",
        message: "Password saat ini harus terdiri dari 8 sampai 128 karakter.",
      });
      return;
    }

    if (
      passwordForm.newPassword.length < 8 ||
      passwordForm.newPassword.length > 128
    ) {
      setNotice({
        type: "error",
        message: "Password baru harus terdiri dari 8 sampai 128 karakter.",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice({
        type: "error",
        message: "Konfirmasi password baru tidak cocok.",
      });
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setNotice({
        type: "error",
        message: "Password baru harus berbeda dari password saat ini.",
      });
      return;
    }

    setChangingPassword(true);

    try {
      await usersApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      clearAuthTokens();
      window.dispatchEvent(new Event("auth:session-expired"));

      navigate("/login", {
        replace: true,
        state: {
          message:
            "Password berhasil diubah. Semua sesi telah dicabut; silakan masuk dengan password baru.",
        },
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, "Password gagal diubah."),
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRevokeSession(session: UserSession) {
    const confirmed = window.confirm(
      "Cabut sesi ini? Perangkat tersebut harus masuk kembali.",
    );

    if (!confirmed) return;

    setBusySessionId(session.id);
    setNotice(null);

    try {
      await usersApi.revokeSession(session.id);

      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      );

      setNotice({
        type: "success",
        message: "Sesi berhasil dicabut.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, "Sesi gagal dicabut."),
      });
    } finally {
      setBusySessionId(null);
    }
  }

  async function handleRevokeAllSessions() {
    const confirmed = window.confirm(
      "Cabut seluruh sesi aktif? Anda juga akan keluar dari perangkat ini dan harus masuk kembali.",
    );

    if (!confirmed) return;

    setRevokingAll(true);
    setNotice(null);

    try {
      await usersApi.revokeAllSessions();

      clearAuthTokens();
      window.dispatchEvent(new Event("auth:session-expired"));

      navigate("/login", {
        replace: true,
        state: {
          message: "Semua sesi telah dicabut. Silakan masuk kembali.",
        },
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, "Semua sesi gagal dicabut."),
      });
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <div className="settings-page">
      <section className="settings-intro">
        <span className="eyebrow">PREFERENSI AKUN</span>
        <h2>Pengaturan</h2>
        <p>
          Kelola informasi pribadi, preferensi aplikasi, dan keamanan akun Anda.
        </p>
      </section>

      {notice && (
        <div
          className={`settings-notice settings-notice-${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span>{notice.message}</span>

          <button
            type="button"
            aria-label="Tutup pesan"
            onClick={() => setNotice(null)}
          >
            <XCircle size={17} />
          </button>
        </div>
      )}

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Menu pengaturan">
          <button
            type="button"
            className={
              activeTab === "profile" ? "settings-tab active" : "settings-tab"
            }
            aria-current={activeTab === "profile" ? "page" : undefined}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={18} />
            <span>
              <strong>Profil</strong>
              <small>Informasi akun Anda</small>
            </span>
          </button>

          <button
            type="button"
            className={
              activeTab === "preferences"
                ? "settings-tab active"
                : "settings-tab"
            }
            aria-current={activeTab === "preferences" ? "page" : undefined}
            onClick={() => setActiveTab("preferences")}
          >
            <Settings2 size={18} />
            <span>
              <strong>Preferensi</strong>
              <small>Format dan waktu</small>
            </span>
          </button>

          <button
            type="button"
            className={
              activeTab === "security" ? "settings-tab active" : "settings-tab"
            }
            aria-current={activeTab === "security" ? "page" : undefined}
            onClick={() => setActiveTab("security")}
          >
            <ShieldCheck size={18} />
            <span>
              <strong>Keamanan</strong>
              <small>Password dan sesi</small>
            </span>
          </button>
        </nav>

        <div className="settings-panel">
          {loading ? (
            <div className="settings-loading" role="status">
              <LoaderCircle className="settings-spinner" size={22} />
              Memuat pengaturan akun…
            </div>
          ) : (
            <>
              {activeTab === "profile" && (
                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div className="settings-icon">
                      <UserRound size={20} />
                    </div>
                    <div>
                      <h3>Profil pengguna</h3>
                      <p>Informasi dasar yang digunakan pada akun Anda.</p>
                    </div>
                  </div>

                  <form
                    className="settings-form"
                    onSubmit={handleProfileSubmit}
                  >
                    <label className="settings-field">
                      <span>Nama lengkap</span>
                      <input
                        value={profileForm.name}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        minLength={2}
                        maxLength={100}
                        required
                        autoComplete="name"
                      />
                    </label>

                    <label className="settings-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(event) =>
                          setProfileForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        maxLength={255}
                        required
                        autoComplete="email"
                      />
                      <small>
                        Perubahan email dapat memerlukan verifikasi ulang.
                        Periksa email Anda setelah menyimpan.
                      </small>
                    </label>

                    <div className="settings-readonly-grid">
                      <div>
                        <span>Status email</span>
                        <strong>
                          {profile?.emailVerifiedAt
                            ? "Terverifikasi"
                            : "Belum terverifikasi"}
                        </strong>
                      </div>
                      <div>
                        <span>Bergabung sejak</span>
                        <strong>{formatDate(profile?.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Status akun</span>
                        <strong>{profile?.status ?? "—"}</strong>
                      </div>
                    </div>

                    <div className="settings-actions">
                      <button
                        className="settings-primary-button"
                        type="submit"
                        disabled={savingProfile}
                      >
                        <Save size={16} />
                        {savingProfile ? "Menyimpan…" : "Simpan profil"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === "preferences" && (
                <section className="settings-card">
                  <div className="settings-card-heading">
                    <div className="settings-icon">
                      <Settings2 size={20} />
                    </div>
                    <div>
                      <h3>Preferensi aplikasi</h3>
                      <p>
                        Sesuaikan format lokal, zona waktu, dan hari pertama
                        dalam seminggu.
                      </p>
                    </div>
                  </div>

                  <form
                    className="settings-form"
                    onSubmit={handlePreferencesSubmit}
                  >
                    <label className="settings-field">
                      <span>Mata uang default</span>
                      <select
                        value={preferences.currency}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            currency: event.target.value,
                          }))
                        }
                      >
                        <option value="IDR">Rupiah Indonesia (IDR)</option>
                      </select>
                      <small>
                        Versi saat ini menggunakan IDR untuk transaksi keuangan.
                      </small>
                    </label>

                    <label className="settings-field">
                      <span>Zona waktu</span>
                      <select
                        value={preferences.timezone}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            timezone: event.target.value,
                          }))
                        }
                      >
                        <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                        <option value="Asia/Makassar">
                          Asia/Makassar (WITA)
                        </option>
                        <option value="Asia/Jayapura">
                          Asia/Jayapura (WIT)
                        </option>
                        <option value="UTC">UTC</option>
                      </select>
                    </label>

                    <label className="settings-field">
                      <span>Bahasa dan format lokal</span>
                      <select
                        value={preferences.locale}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            locale: event.target.value,
                          }))
                        }
                      >
                        <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                        <option value="en-US">English (United States)</option>
                      </select>
                    </label>

                    <fieldset className="settings-field settings-weekdays">
                      <legend>Hari pertama dalam seminggu</legend>
                      <div className="settings-choice-grid">
                        {[
                          { value: 0, label: "Minggu" },
                          { value: 1, label: "Senin" },
                          { value: 2, label: "Selasa" },
                          { value: 3, label: "Rabu" },
                          { value: 4, label: "Kamis" },
                          { value: 5, label: "Jumat" },
                          { value: 6, label: "Sabtu" },
                        ].map((day) => (
                          <label
                            key={day.value}
                            className={
                              preferences.weekStartsOn === day.value
                                ? "settings-choice selected"
                                : "settings-choice"
                            }
                          >
                            <input
                              type="radio"
                              name="weekStartsOn"
                              value={day.value}
                              checked={preferences.weekStartsOn === day.value}
                              onChange={() =>
                                setPreferences((current) => ({
                                  ...current,
                                  weekStartsOn: day.value,
                                }))
                              }
                            />
                            <span>{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="settings-actions">
                      <button
                        className="settings-primary-button"
                        type="submit"
                        disabled={savingPreferences}
                      >
                        <Save size={16} />
                        {savingPreferences ? "Menyimpan…" : "Simpan preferensi"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === "security" && (
                <div className="settings-security-stack">
                  <section className="settings-card">
                    <div className="settings-card-heading">
                      <div className="settings-icon">
                        <KeyRound size={20} />
                      </div>
                      <div>
                        <h3>Ganti password</h3>
                        <p>
                          Setelah password berhasil diubah, backend mencabut
                          seluruh sesi refresh token. Anda harus masuk kembali.
                        </p>
                      </div>
                    </div>

                    <form
                      className="settings-form"
                      onSubmit={handlePasswordSubmit}
                    >
                      <label className="settings-field">
                        <span>Password saat ini</span>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              currentPassword: event.target.value,
                            }))
                          }
                          minLength={8}
                          maxLength={128}
                          autoComplete="current-password"
                          required
                        />
                      </label>

                      <label className="settings-field">
                        <span>Password baru</span>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                        />
                        <small>
                          Gunakan minimal 8 karakter dan maksimal 128 karakter.
                        </small>
                      </label>

                      <label className="settings-field">
                        <span>Konfirmasi password baru</span>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value,
                            }))
                          }
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                        />
                      </label>

                      <div className="settings-actions">
                        <button
                          className="settings-primary-button"
                          type="submit"
                          disabled={changingPassword}
                        >
                          <KeyRound size={16} />
                          {changingPassword
                            ? "Mengubah password…"
                            : "Ubah password"}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="settings-card">
                    <div className="settings-card-heading settings-sessions-heading">
                      <div className="settings-icon">
                        <MonitorSmartphone size={20} />
                      </div>
                      <div>
                        <h3>Sesi aktif</h3>
                        <p>
                          Cabut akses perangkat yang tidak lagi Anda gunakan.
                        </p>
                      </div>
                      <button
                        className="settings-danger-button"
                        type="button"
                        onClick={() => void handleRevokeAllSessions()}
                        disabled={revokingAll || sessions.length === 0}
                      >
                        {revokingAll ? "Memproses…" : "Cabut semua"}
                      </button>
                    </div>

                    {sessions.length === 0 ? (
                      <div className="settings-empty">
                        Tidak ada sesi aktif yang ditemukan.
                      </div>
                    ) : (
                      <div className="settings-session-list">
                        {sessions.map((session) => (
                          <article
                            className="settings-session"
                            key={session.id}
                          >
                            <div className="settings-session-device">
                              <MonitorSmartphone size={18} />
                              <div>
                                <strong>{describeSession(session)}</strong>
                                <span>
                                  {session.ipAddress ||
                                    "Alamat IP tidak tersedia"}
                                </span>
                                <small>
                                  Dibuat {formatDate(session.createdAt)}
                                  {" · "}
                                  Terakhir aktif{" "}
                                  {formatDate(session.lastUsedAt)}
                                  {" · "}
                                  Berakhir {formatDate(session.expiresAt)}
                                </small>
                              </div>
                            </div>

                            <button
                              className="settings-revoke-button"
                              type="button"
                              onClick={() => void handleRevokeSession(session)}
                              disabled={busySessionId === session.id}
                            >
                              {busySessionId === session.id
                                ? "Mencabut…"
                                : "Cabut sesi"}
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
