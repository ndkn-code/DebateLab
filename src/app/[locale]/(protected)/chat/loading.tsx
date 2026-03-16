export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-0px)] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="hidden w-[280px] shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest p-3 lg:block">
        <div className="mb-4 h-9 rounded-lg bg-surface-container-high" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-surface-container-high/60" />
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-outline-variant/10 px-4 py-3">
          <div className="h-8 w-40 rounded-lg bg-surface-container-high" />
        </div>
        <div className="flex-1" />
        <div className="border-t border-outline-variant/10 px-4 py-3">
          <div className="h-11 rounded-2xl bg-surface-container-high/60" />
        </div>
      </div>
    </div>
  );
}
