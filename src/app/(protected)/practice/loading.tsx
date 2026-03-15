export default function PracticeLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-8 w-56 rounded-lg bg-surface-container-high" />
          <div className="mt-2 h-4 w-80 rounded bg-surface-container-high/60" />
        </div>

        {/* Category tabs */}
        <div className="mb-6 flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-surface-container-high/60" />
          ))}
        </div>

        {/* Shuffle button */}
        <div className="mb-6 flex justify-end">
          <div className="h-9 w-28 rounded-lg bg-surface-container-high/40" />
        </div>

        {/* Topic cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
