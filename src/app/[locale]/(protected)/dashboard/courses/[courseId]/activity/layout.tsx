// Full-screen layout for activity player — no sidebar
export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-[#fbf8ff] overflow-y-auto">
      {children}
    </div>
  );
}
