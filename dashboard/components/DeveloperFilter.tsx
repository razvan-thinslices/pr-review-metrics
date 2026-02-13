'use client'

import { useState, useRef, useEffect } from 'react'

interface DeveloperFilterProps {
  developers: string[]
  excludedDevs: Set<string>
  onChange: (excluded: Set<string>) => void
}

export default function DeveloperFilter({ developers, excludedDevs, onChange }: DeveloperFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isOpen])

  const filtered = developers.filter(dev =>
    dev.toLowerCase().includes(search.toLowerCase())
  )

  const toggleDev = (dev: string) => {
    const next = new Set(excludedDevs)
    if (next.has(dev)) {
      next.delete(dev)
    } else {
      next.add(dev)
    }
    onChange(next)
  }

  const excludeAll = () => {
    onChange(new Set(filtered))
  }

  const clearAll = () => {
    if (search) {
      // Only re-include the filtered (visible) devs
      const next = new Set(excludedDevs)
      for (const dev of filtered) {
        next.delete(dev)
      }
      onChange(next)
    } else {
      onChange(new Set())
    }
  }

  const count = excludedDevs.size

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Exclude Developers
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-700 dark:text-gray-300 min-w-[200px]"
      >
        <span className="flex-1 text-left truncate">
          {count === 0
            ? 'None excluded'
            : `${count} developer${count !== 1 ? 's' : ''} excluded`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search developers..."
              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Bulk actions */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 text-xs">
            <button
              onClick={excludeAll}
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Exclude {search ? 'visible' : 'all'}
            </button>
            <button
              onClick={clearAll}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Include {search ? 'visible' : 'all'}
            </button>
          </div>

          {/* Developer list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No developers match &ldquo;{search}&rdquo;
              </div>
            ) : (
              filtered.map(dev => {
                const isExcluded = excludedDevs.has(dev)
                return (
                  <button
                    key={dev}
                    onClick={() => toggleDev(dev)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                        isExcluded
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}
                    >
                      {isExcluded && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                    <span className={`truncate ${isExcluded ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                      {dev}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer with count */}
          {count > 0 && (
            <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {count} of {developers.length} developer{developers.length !== 1 ? 's' : ''} excluded
            </div>
          )}
        </div>
      )}
    </div>
  )
}
