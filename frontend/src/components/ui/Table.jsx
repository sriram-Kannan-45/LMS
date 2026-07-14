import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'

export default function Table({
  columns = [],
  data = [],
  onRowClick,
  emptyMessage = 'No data available',
  onSort,
}) {
  const [sortKey, setSortKey] = useState('')
  const [sortOrder, setSortOrder] = useState('asc') // asc | desc

  const handleSort = (key) => {
    if (!onSort) return
    const order = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortOrder(order)
    onSort(key, order)
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-850/50">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none ${
                  col.sortable ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''
                } ${col.className || ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{col.header}</span>
                  {col.sortable && (
                    <span className="text-slate-400">
                      {sortKey !== col.key ? (
                        <ArrowUpDown size={12} />
                      ) : sortOrder === 'asc' ? (
                        <ArrowUp size={12} className="text-primary-600 dark:text-primary-400" />
                      ) : (
                        <ArrowDown size={12} className="text-primary-600 dark:text-primary-400" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`group transition-colors duration-150 ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30' : 'hover:bg-slate-50/25 dark:hover:bg-slate-800/10'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium ${col.className || ''}`}
                  >
                    {col.render ? col.render(row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
