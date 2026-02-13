'use client'

interface MonthSelectorProps {
  months: string[]
  selectedMonth: string | null
  onSelectMonth: (month: string) => void
}

export default function MonthSelector({ months, selectedMonth, onSelectMonth }: MonthSelectorProps) {
  return (
    <div>
      <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Select Month
      </label>
      <select
        id="month-select"
        value={selectedMonth || ''}
        onChange={(e) => onSelectMonth(e.target.value)}
        className="block w-full max-w-xs px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Select a month...</option>
        {months.map((month) => (
          <option key={month} value={month}>
            {month}
          </option>
        ))}
      </select>
    </div>
  )
}
