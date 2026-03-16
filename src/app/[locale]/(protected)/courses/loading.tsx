export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8 animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-surface-container-high" />
        <div className="mt-2 h-4 w-72 rounded bg-surface-container-high/60" />
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-lg bg-surface-container-high/60" />
        ))}
      </div>

      {/* Course cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-56 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest"
          />
        ))}
      </div>
    </div>
  );
}
