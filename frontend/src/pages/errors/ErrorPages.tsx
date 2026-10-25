import { Link } from 'react-router-dom';
export function ErrorPage({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <main className="center-state">
      <section className="panel" style={{ maxWidth: 520 }}>
        <p className="muted">{code}</p>
        <h1>{title}</h1>
        <p>{text}</p>
        <Link className="button" to="/dashboard">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
