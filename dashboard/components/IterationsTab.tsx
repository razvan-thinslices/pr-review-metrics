'use client'

import { MetricsData } from '@/types/metrics'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface IterationsTabProps {
  data: MetricsData
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function IterationsTab({ data }: IterationsTabProps) {
  // Average iterations per reviewer
  const iterationsByReviewer = data.summary
    .map(r => ({
      reviewer: r.reviewer,
      avgIterations: parseFloat(r.avgIterationsPerPr),
      multipleRounds: r.prsWithMultipleRounds
    }))
    .sort((a, b) => b.avgIterations - a.avgIterations)
    .slice(0, 15)

  // PRs with most review rounds
  const mostIteratedPRs = data.details
    .map(pr => ({
      pr: `${pr.repo}#${pr.number}`,
      title: pr.title,
      iterations: pr.iterationCount,
      url: pr.url
    }))
    .sort((a, b) => b.iterations - a.iterations)
    .slice(0, 10)

  // Single vs multi-round reviews
  const singleRound = data.details.filter(pr => pr.iterationCount <= 1).length
  const multiRound = data.details.filter(pr => pr.iterationCount > 1).length
  const pieData = [
    { name: 'Single Round', value: singleRound },
    { name: 'Multiple Rounds', value: multiRound }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Average Iterations per Reviewer
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={iterationsByReviewer}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reviewer" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgIterations" fill="#3b82f6" name="Avg Iterations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Single vs Multi-Round Reviews
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Most Iterated PRs
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-y-auto max-h-[350px]">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      PR
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Iterations
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {mostIteratedPRs.map((pr, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {pr.pr}
                        </a>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {pr.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {pr.iterations}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
