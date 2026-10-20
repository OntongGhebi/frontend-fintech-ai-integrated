import { Link, useLocation } from "react-router-dom";

import { AuthLayout } from "../components/auth/AuthLayout";

export function RegisterSuccessPage() {
  const location = useLocation();

  const email = (location.state as { email?: string } | null)?.email;

  return (
    <AuthLayout
      eyebrow="REGISTRATION COMPLETE"
      title="Periksa emailmu"
      description="Satu langkah lagi sebelum kamu mulai mengelola keuanganmu."
      footer={
        <>
          Sudah melakukan verifikasi? <Link to="/login">Masuk ke akun</Link>
        </>
      }
    >
      <div className="auth-v2-status">
        <div className="auth-v2-status-icon" aria-hidden="true">
          ✓
        </div>

        <p>
          Akun berhasil dibuat. Buka tautan verifikasi yang dikirim ke alamat
          emailmu sebelum mencoba login.
        </p>

        {email && (
          <div className="auth-v2-success">
            Email tujuan
            <br />
            <strong>{email}</strong>
          </div>
        )}

        <Link className="auth-v2-primary-link" to="/login">
          Ke halaman login <span aria-hidden="true">→</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
