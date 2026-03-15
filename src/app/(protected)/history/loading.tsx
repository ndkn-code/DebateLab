export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-8 w-48 rounded-lg bg-surface-container-high" />
          <div className="mt-2 h-4 w-72 rounded bg-surface-container-high/60" />
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-outline-variant/10 bg-surface-container-lowest"
            />
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="mb-6 space-y-3">
          <div className="flex gap-3">
            <div className="h-9 flex-1 rounded-lg bg-surface-container-high/60" />
            <div className="h-9 w-44 rounded-lg bg-surface-container-high/60" />
          </div>
          <div className="flex gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-lg bg-surface-container-high/40" />
            ))}
          </div>
        </div>

        {/* Session cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-outline-variant/10 bg-surface-container-lowest"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
