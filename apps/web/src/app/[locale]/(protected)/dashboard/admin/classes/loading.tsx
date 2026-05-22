export default function AdminClassesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-8 w-48 rounded-lg bg-surface-container-high" />
      <div className="mt-2 h-4 w-80 rounded-lg bg-surface-container-high" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
        ))}
      </div>
      <div className="mt-6 h-16 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
      <div className="mt-4 h-96 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
    </div>
  );
}
