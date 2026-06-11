export const Breadcrumbs = ({items=[]}) => {
  return (
    <nav className="text-xs text-slate-400 mb-3 overflow-x-auto whitespace-nowrap scrollbar-none" aria-label="Breadcrumb">
      {items.map((it, idx) => (
        <span key={idx} className="inline-flex items-center">
          {idx>0 && <span className="mx-2">/</span>}
          <span className={idx===items.length-1? 'text-slate-200 font-semibold':''}>{it}</span>
        </span>
      ))}
    </nav>
  );
}
