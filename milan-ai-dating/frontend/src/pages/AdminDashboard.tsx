import { useState } from 'react'
import { 
  Users, 
  MessageSquare, 
  Shield, 
  TrendingUp, 
  Flag,
  DollarSign,
  Activity
} from 'lucide-react'

const stats = [
  { name: 'Total Users', value: '15,234', icon: Users, change: '+12%', color: 'blue' },
  { name: 'Active Matches', value: '8,456', icon: MessageSquare, change: '+8%', color: 'green' },
  { name: 'Reports', value: '23', icon: Flag, change: '-5%', color: 'red' },
  { name: 'Revenue (NPR)', value: '245,000', icon: DollarSign, change: '+18%', color: 'purple' },
]

const recentReports = [
  { id: 1, user: 'John Doe', reason: 'Inappropriate content', status: 'pending', date: '2 min ago' },
  { id: 2, user: 'Jane Smith', reason: 'Fake profile', status: 'reviewing', date: '15 min ago' },
  { id: 3, user: 'Mike Johnson', reason: 'Harassment', status: 'resolved', date: '1 hour ago' },
]

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Activity },
    { id: 'users', name: 'Users', icon: Users },
    { id: 'reports', name: 'Reports', icon: Flag },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp },
    { id: 'safety', name: 'Safety', icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Admin User</span>
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-medium">
                A
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-pink-100 text-pink-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.map((stat) => (
                    <div key={stat.name} className="bg-white p-6 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                          <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                        </div>
                        <span className={`text-sm font-medium text-${stat.change.startsWith('+') ? 'green' : 'red'}-600`}>
                          {stat.change}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-sm text-gray-500">{stat.name}</p>
                    </div>
                  ))}
                </div>

                {/* Recent Reports */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Recent Reports</h2>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {recentReports.map((report) => (
                      <div key={report.id} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{report.user}</p>
                          <p className="text-sm text-gray-500">{report.reason}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            report.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : report.status === 'reviewing'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {report.status}
                          </span>
                          <span className="text-sm text-gray-400">{report.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">User Management</h2>
                <p className="text-gray-500">User management features coming soon...</p>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Content Moderation</h2>
                <p className="text-gray-500">Moderation queue features coming soon...</p>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Platform Analytics</h2>
                <p className="text-gray-500">Analytics dashboard coming soon...</p>
              </div>
            )}

            {activeTab === 'safety' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Safety & Security</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="font-medium text-green-800">AI Safety Systems</p>
                    <p className="text-sm text-green-600">All systems operational</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-800">Fraud Detection</p>
                    <p className="text-sm text-blue-600">3 suspicious accounts flagged today</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
