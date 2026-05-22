export default function HistoryLoading() {
  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary-container" />
          <div>
            <div className="h-11 w-72 rounded-lg bg-outline-variant/60" />
            <div className="mt-3 h-5 w-full max-w-[320px] rounded bg-outline-variant/50" />
          </div>
        </div>

        <div className="mb-5 mt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest lg:w-[320px]" />
            <div className="flex gap-2">
              <div className="h-10 w-[78px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-10 w-[98px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-10 w-[78px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest" />
            </div>
            <div className="h-10 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest lg:ml-auto lg:w-[220px]" />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <main className="flex flex-col gap-2.5">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="h-[112px] rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest"
              />
            ))}
            <div className="mt-2.5 h-14 rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest" />
          </main>
          <aside>
            <div className="h-[548px] rounded-[1.5rem] border border-outline-variant/30 bg-surface-container-lowest" />
          </aside>
        </div>
      </div>
    </div>
  );
}
