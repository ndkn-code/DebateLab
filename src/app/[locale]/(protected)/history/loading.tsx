export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1360px] animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary-container" />
          <div>
            <div className="h-11 w-72 rounded-lg bg-outline-variant/60" />
            <div className="mt-3 h-5 w-[380px] max-w-full rounded bg-outline-variant/50" />
          </div>
        </div>

        <div className="mb-6 mt-9 xl:pr-[332px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest lg:w-[320px]" />
            <div className="flex gap-2.5">
              <div className="h-12 w-[86px] rounded-2xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-12 w-[104px] rounded-2xl border border-outline-variant/60 bg-surface-container-lowest" />
              <div className="h-12 w-[86px] rounded-2xl border border-outline-variant/60 bg-surface-container-lowest" />
            </div>
            <div className="h-12 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest lg:ml-auto lg:w-[220px]" />
          </div>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
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
