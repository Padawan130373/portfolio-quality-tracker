export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <p className="text-6xl font-bold text-muted-foreground/20 mb-4" style={{ fontFamily: "var(--font-display)" }}>404</p>
      <p className="text-lg font-semibold mb-1">Page introuvable</p>
      <p className="text-sm text-muted-foreground">La page que vous cherchez n'existe pas.</p>
    </div>
  );
}
