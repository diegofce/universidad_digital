export function Loading() {
  return (
    <p aria-live="polite" className="muted">
      Cargando información...
    </p>
  );
}
export function Empty({ message = 'No hay información disponible.' }: { message?: string }) {
  return <p className="muted">{message}</p>;
}
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="alert">
      {message}
    </p>
  );
}
