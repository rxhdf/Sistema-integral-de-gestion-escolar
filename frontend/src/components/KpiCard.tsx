export function KpiCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-variant shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
      </div>
      <div>
        <p className="text-label-md font-label-md text-secondary mb-1">{label}</p>
        <p className="text-headline-md font-headline-md font-bold text-on-surface">
          {value.toLocaleString('es-MX')}
        </p>
      </div>
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-surface-container-lowest p-6 rounded-xl border border-surface-variant animate-pulse flex flex-col justify-between"
    >
      <div className="w-8 h-8 rounded-full bg-surface-container mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-24 bg-surface-container rounded" />
        <div className="h-6 w-16 bg-surface-container rounded" />
      </div>
    </div>
  )
}
