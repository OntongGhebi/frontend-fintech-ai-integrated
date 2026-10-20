import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthLayout } from "../components/auth/AuthLayout";
import { useAuth } from "../contexts/AuthContext"; 
import { ApiRequestError } from "../lib/api-client";

export function LoginPage() {
  const { login, isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/";

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
    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
      });

      navigate(destination, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Login gagal. Periksa koneksi dan coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Masuk ke akunmu"
      description="Masuk untuk melihat ringkasan dan mengelola keuangan pribadimu."
      footer={
        <>
          Belum punya akun? <Link to="/register">Daftar sekarang</Link>
        </>
      }
    >
      <form className="auth-v2-form" onSubmit={handleSubmit} noValidate={false}>
        <label htmlFor="login-email">Alamat email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="nama@email.com"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(error)}
        />

        {error && (
          <p className="auth-v2-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Masuk ke akun"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </AuthLayout>
  );
}
