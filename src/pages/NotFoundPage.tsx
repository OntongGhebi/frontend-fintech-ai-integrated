import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span className="eyebrow">404 — NOT FOUND</span>
      <h2>Page not found</h2>
      <p>The page you requested does not exist.</p>
      <Link className="primary-link" to="/">
        Return to dashboard
      </Link>
    </section>
  );
}
