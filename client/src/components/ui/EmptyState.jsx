export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center mb-3 text-slate-500 text-xl shadow-subtle">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800 mb-1 tracking-tight">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">{description}</p>}
      {action}
    </div>
  )
}
