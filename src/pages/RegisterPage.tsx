import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../contexts/AuthContext";
import { ApiRequestError } from "../lib/api-client";

export function RegisterPage() {
  const { register, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isInitializing) {
    return (
      <main className="auth-v2-screen" aria-live="polite">
        <div className="auth-v2-status">
          <div className="auth-v2-status-icon">F</div>
          <p>Memeriksa sesi akunmu...</p>
        </div>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmation) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      navigate("/register/success", {
        replace: true,
        state: { email: email.trim() },
      });
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Pendaftaran gagal. Periksa koneksi dan coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="GET STARTED"
      title="Buat akun baru"
      description="Mulai kelola pemasukan, pengeluaran, dan anggaran dalam satu tempat."
      footer={
        <>
          Sudah memiliki akun? <Link to="/login">Masuk</Link>
        </>
      }
    >
      <form className="auth-v2-form" onSubmit={handleSubmit}>
        <label htmlFor="register-name">Nama lengkap</label>
        <input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Masukkan nama lengkap"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(error)}
        />

        <label htmlFor="register-email">Alamat email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
        />

        <label htmlFor="register-password">Password</label>
        <div className="auth-v2-password-control">
          <input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Buat password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
          />

          <button
            type="button"
            className="auth-v2-password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <label htmlFor="register-confirmation">Konfirmasi password</label>
        <div className="auth-v2-password-control">
          <input
            id="register-confirmation"
            name="passwordConfirmation"
            type={showConfirmation ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Ulangi password"
            required
            minLength={8}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={Boolean(error)}
          />

          <button
            type="button"
            className="auth-v2-password-toggle"
            onClick={() => setShowConfirmation((visible) => !visible)}
            aria-label={
              showConfirmation
                ? "Sembunyikan konfirmasi password"
                : "Tampilkan konfirmasi password"
            }
            aria-pressed={showConfirmation}
          >
            {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <p className="auth-v2-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Membuat akun..." : "Buat akun"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </AuthLayout>
  );
}
