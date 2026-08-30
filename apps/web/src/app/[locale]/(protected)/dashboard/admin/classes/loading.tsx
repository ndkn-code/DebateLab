export default function AdminClassesLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="h-7 w-48 animate-pulse rounded-[10px] bg-surface-container-high" />
      <div className="mt-2 h-4 w-80 rounded-lg bg-surface-container-high" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[10px] border border-outline-variant bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-16 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
      <div className="mt-4 h-96 rounded-lg border border-outline-variant/20 bg-surface-container-lowest" />
    </div>
  );
}
