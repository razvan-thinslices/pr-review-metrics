'use client'

import { useState, useEffect } from 'react'
import { MetricsData } from '@/types/metrics'
import MonthSelector from '@/components/MonthSelector'
import SummaryCards from '@/components/SummaryCards'
import OverviewTab from '@/components/OverviewTab'
import ResponseTimeTab from '@/components/ResponseTimeTab'
import ComplexityTab from '@/components/ComplexityTab'
import IterationsTab from '@/components/IterationsTab'
import AuthorMetricsTab from '@/components/AuthorMetricsTab'
import ReviewerActivityTab from '@/components/ReviewerActivityTab'
import DetailTable from '@/components/DetailTable'

type Tab = 'overview' | 'response-time' | 'complexity' | 'iterations' | 'author-metrics' | 'reviewer-activity' | 'details'

export default function Home() {
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Fetch available months on mount
  useEffect(() => {
    fetch('/api/months')
      .then(res => res.json())
      .then(data => {
        setMonths(data.months)
        if (data.months.length > 0 && !selectedMonth) {
          setSelectedMonth(data.months[0])
        }
      })
      .catch(err => {
        console.error('Failed to fetch months:', err)
        setError('Failed to load available months')
      })
  }, [selectedMonth])

  // Fetch data when month changes
  useEffect(() => {
    if (!selectedMonth) return

    setLoading(true)
    setError(null)
    
    fetch(`/api/data/${selectedMonth}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch data')
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch data:', err)
        setError('Failed to load data for this month')
        setLoading(false)
      })
  }, [selectedMonth])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'response-time', label: 'Response Time' },
    { id: 'complexity', label: 'PR Complexity' },
    { id: 'iterations', label: 'Iterations' },
    { id: 'author-metrics', label: 'Author Metrics' },
    { id: 'reviewer-activity', label: 'Reviewer Activity' },
    { id: 'details', label: 'All PRs' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            PR Review Metrics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze GitHub pull request review patterns and performance
          </p>
        </header>

        <MonthSelector
          months={months}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
        />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <SummaryCards data={data} />

            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                        ${activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }
                      `}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="mt-6">
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'response-time' && <ResponseTimeTab data={data} />}
              {activeTab === 'complexity' && <ComplexityTab data={data} />}
              {activeTab === 'iterations' && <IterationsTab data={data} />}
              {activeTab === 'author-metrics' && <AuthorMetricsTab data={data} />}
              {activeTab === 'reviewer-activity' && <ReviewerActivityTab data={data} />}
              {activeTab === 'details' && <DetailTable data={data} />}
            </div>
          </>
        )}

        {!loading && !error && !data && selectedMonth && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No data available. Please run the metrics collection script first.
          </div>
        )}

        {!loading && !error && months.length === 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
              No Data Available
            </h3>
            <p className="text-blue-800 dark:text-blue-300 mb-4">
              Run the data collection script to generate metrics:
            </p>
            <pre className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded text-sm text-blue-900 dark:text-blue-100 overflow-x-auto">
              node scripts/collect-metrics.js --org=thgenergy --repos=fe-redesign,be-revamp,API-docs
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
