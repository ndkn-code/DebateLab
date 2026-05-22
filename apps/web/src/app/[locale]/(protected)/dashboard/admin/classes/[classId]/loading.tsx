export default function AdminClassDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-4 w-32 rounded bg-surface-container-high" />
      <div className="mt-5 h-9 w-72 rounded-lg bg-surface-container-high" />
      <div className="mt-6 h-20 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
        <div className="h-80 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
      </div>
    </div>
  );
}
