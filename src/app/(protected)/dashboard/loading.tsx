export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8 animate-pulse">
      {/* Greeting skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 rounded-lg bg-surface-container-high" />
        <div className="mt-2 h-4 w-48 rounded bg-surface-container-high/60" />
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest"
          />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="mb-8 h-64 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest" />

      {/* Two column */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-48 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest" />
        <div className="h-48 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest" />
      </div>
    </div>
  );
}
