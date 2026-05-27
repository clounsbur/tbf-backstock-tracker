export function PageHeader({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <header className="page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
    </header>
  );
}
