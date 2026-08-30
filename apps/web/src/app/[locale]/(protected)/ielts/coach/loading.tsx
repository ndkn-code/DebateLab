export default function IeltsCoachLoading() {
  return (
    <div className="mx-auto grid h-full w-full max-w-[1440px] gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-h-[560px] animate-pulse rounded-xl border border-outline-variant bg-surface motion-reduce:animate-none" />
      <div className="hidden space-y-4 lg:block">
        <div className="h-44 animate-pulse rounded-xl border border-outline-variant bg-surface motion-reduce:animate-none" />
        <div className="h-52 animate-pulse rounded-xl border border-outline-variant bg-surface motion-reduce:animate-none" />
      </div>
    </div>
  );
}
