export default function ProfileLoading() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden bg-background px-4 py-4 sm:px-6 md:h-screen lg:px-8 lg:py-6">
      <div className="mx-auto flex h-full max-w-[1400px] min-h-0 flex-col animate-pulse">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="h-11 w-56 rounded-lg bg-outline-variant/50" />
            <div className="mt-3 h-6 w-[420px] max-w-full rounded bg-outline-variant/35" />
          </div>
          <div className="h-12 w-64 rounded-full border border-outline-variant/20 bg-surface" />
        </div>

        <div className="mt-6 grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="h-[392px] rounded-[1.8rem] border border-outline-variant/15 bg-surface" />
            <div className="h-[392px] rounded-[1.8rem] border border-outline-variant/15 bg-surface" />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-[210px] rounded-[1.65rem] border border-outline-variant/15 bg-surface"
              />
            ))}
          </div>

          <div className="min-h-0 rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5">
            <div className="h-7 w-44 rounded bg-outline-variant/40" />
            <div className="mt-4 space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="h-[104px] rounded-[1.35rem] bg-surface-container-lowest"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
