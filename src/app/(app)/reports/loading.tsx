export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-72 rounded-lg bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200/60" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 rounded-xl bg-slate-200/60" />
        <div className="h-80 rounded-xl bg-slate-200/60" />
      </div>
    </div>
  );
}
