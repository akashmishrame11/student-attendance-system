import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { AsyncBlock } from "./feedback";

/**
 * columns: [{ key, label, render?: (row) => node, sortable?: bool, className?, hideOn?: "sm"|"md"|"lg" }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, rowKey = (r) => r._id, empty, sort, onSort, onRowClick, dense }) {
  const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };
  const toggleSort = (key) => {
    if (!onSort) return;
    onSort(sort === key ? `-${key}` : key);
  };
  return (
    <AsyncBlock loading={loading} error={error} onRetry={onRetry} empty={!rows?.length} emptyProps={empty}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.hideOn ? hide[c.hideOn] : ""} ${c.headClass || ""}`}>
                  {c.sortable && onSort ? (
                    <button className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort === c.key ? <ArrowUp className="h-3 w-3" /> : sort === `-${c.key}` ? <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((row, i) => (
              <tr key={rowKey(row, i)} className={`transition-colors hover:bg-slate-50/70 ${onRowClick ? "cursor-pointer" : ""}`} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 ${dense ? "py-2" : "py-3"} align-middle text-slate-700 ${c.hideOn ? hide[c.hideOn] : ""} ${c.className || ""}`}>
                    {c.render ? c.render(row, i) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AsyncBlock>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.total === 0) return null;
  const { page, pages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const nums = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}–{to}</span> of <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className={`${btn} text-slate-500 hover:bg-slate-100 disabled:opacity-40`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((p) => (
          <button key={p} onClick={() => onPage(p)} className={`${btn} ${p === page ? "bg-brand-600 font-medium text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {p}
          </button>
        ))}
        <button className={`${btn} text-slate-500 hover:bg-slate-100 disabled:opacity-40`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
