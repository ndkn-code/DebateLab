export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-8 animate-pulse">
      <div className="mb-8 h-8 w-32 rounded-lg bg-surface-container-high" />
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="mb-8 h-48 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest"
        />
      ))}
    </div>
  );
}
