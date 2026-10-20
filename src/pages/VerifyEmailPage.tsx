import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AuthLayout } from "../components/auth/AuthLayout";
import { ApiRequestError, authApi } from "../lib/api-client";

type VerificationState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerificationState>({
    status: "loading",
    message: "Kami sedang memeriksa tautan verifikasi.",
  });

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!token) {
        setState({
          status: "error",
          message:
            "Token verifikasi tidak ditemukan. Buka kembali tautan dari email.",
        });
        return;
      }

      setState({
        status: "loading",
        message: "Kami sedang memeriksa tautan verifikasi.",
      });

      try {
        const result = await authApi.verifyEmail(token);

        if (active) {
          setState({
            status: "success",
            message: result.message || "Alamat email berhasil diverifikasi.",
          });
        }
      } catch (cause) {
        if (active) {
          setState({
            status: "error",
            message:
              cause instanceof ApiRequestError
                ? cause.message
                : "Verifikasi belum berhasil. Periksa koneksi lalu coba kembali.",
          });
        }
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [token]);

  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  return (
    <AuthLayout
      eyebrow="EMAIL VERIFICATION"
      title={
        state.status === "loading"
          ? "Memverifikasi email"
          : isSuccess
            ? "Email terverifikasi"
            : "Verifikasi belum berhasil"
      }
      description={
        state.status === "loading"
          ? "Mohon tunggu sebentar selagi kami memeriksa tautanmu."
          : isSuccess
            ? "Akunmu siap digunakan setelah proses verifikasi ini selesai."
            : "Tautan mungkin tidak valid atau sudah kedaluwarsa."
      }
      footer={
        <>
          Mengalami kendala? <Link to="/login">Kembali ke login</Link>
        </>
      }
    >
      <div className="auth-v2-status" aria-live="polite">
        <div
          className={`auth-v2-status-icon${isError ? " is-error" : ""}`}
          aria-hidden="true"
        >
          {state.status === "loading" ? "…" : isSuccess ? "✓" : "!"}
        </div>

        <p
          className={
            isError ? "auth-v2-error" : isSuccess ? "auth-v2-success" : ""
          }
        >
          {state.message}
        </p>

        {isSuccess && (
          <Link className="auth-v2-primary-link" to="/login">
            Lanjut ke login <span aria-hidden="true">→</span>
          </Link>
        )}

        {isError && (
          <Link className="auth-v2-primary-link" to="/register">
            Kembali ke pendaftaran
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}
