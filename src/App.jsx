import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

// Gauge Chart Component
const GaugeChart = ({ value, max, label }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const getColor = (pct) => {
    if (pct >= 80) return '#22c55e'
    if (pct >= 50) return '#eab308'
    return '#ef4444'
  }
  const gaugeColor = getColor(percentage)
  const rotation = (percentage / 100) * 180

  return (
    <div className="gauge-container">
      <div className="gauge">
        <div className="gauge-bg"></div>
        <div className="gauge-fill" style={{
          background: `conic-gradient(${gaugeColor} 0deg, ${gaugeColor} ${rotation}deg, transparent ${rotation}deg)`,
        }}></div>
        <div className="gauge-center">
          <span className="gauge-value" style={{ color: gaugeColor }}>{value}</span>
          <span className="gauge-max">/{max}</span>
        </div>
      </div>
      <div className="gauge-label">{label}</div>
      <div className="gauge-percent">{percentage.toFixed(0)}% filled</div>
    </div>
  )
}

// Leaderboard Component
const Leaderboard = ({ title, data, color }) => {
  const [sortBy, setSortBy] = useState('confirmed')
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 10)
  }, [data, sortBy])

  const colorClasses = {
    blue: '#3b82f6', green: '#22c55e', purple: '#8b5cf6', orange: '#f97316'
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-header" style={{ backgroundColor: colorClasses[color] }}>
        <span>🏆 {title}</span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="confirmed">By Confirmed</option>
          <option value="contacted">By Contacted</option>
        </select>
      </div>
      <div className="leaderboard-body">
        {sortedData.map((rep, idx) => (
          <div key={rep.name} className={`leaderboard-row ${idx < 3 ? 'top-three' : ''}`}>
            <span className={`rank rank-${idx + 1}`}>{idx + 1}</span>
            <span className="rep-name">{rep.name}</span>
            <div className="rep-stats">
              <span className="confirmed">{rep.confirmed} ✓</span>
              <span className="contacted">{rep.contacted} total</span>
            </div>
          </div>
        ))}
        {sortedData.length === 0 && <div className="no-data">No data yet</div>}
      </div>
    </div>
  )
}

// Status colors
const statusColors = {
  'Confirmed': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Invited': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'To be contacted': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  "Can't attend": { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  'Rescheduled': { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
}

const statuses = ['To be contacted', 'Invited', 'Confirmed', "Can't attend", 'Rescheduled']

// Main App
export default function App() {
  const [invitations, setInvitations] = useState([])
  const [salesReps, setSalesReps] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterRep, setFilterRep] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterCohort, setFilterCohort] = useState('')

  const [newInvitation, setNewInvitation] = useState({
    company: '', name: '', role: '', email: '', linkedin: '',
    sales_rep: '', course: '', region: '', cohort_date: '', status: 'To be contacted', notes: ''
  })

  // Fetch data on load
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [invRes, repRes, cohRes] = await Promise.all([
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('sales_reps').select('*').order('name'),
      supabase.from('cohorts').select('*').order('date')
    ])
    if (invRes.data) setInvitations(invRes.data)
    if (repRes.data) setSalesReps(repRes.data)
    if (cohRes.data) setCohorts(cohRes.data)
    setLoading(false)
  }

  // Get today's date for filtering active/upcoming cohorts
  const today = new Date().toISOString().split('T')[0]

  // Filter to only active/upcoming cohorts (date >= today)
  const activeCohorts = useMemo(() => {
    return cohorts.filter(c => c.date >= today)
  }, [cohorts, today])

  // Calculate metrics
  const metrics = useMemo(() => {
    const confirmed2026 = invitations.filter(i => i.status === 'Confirmed' && i.cohort_date?.startsWith('2026')).length
    const invited = invitations.filter(i => i.status === 'Invited' && i.cohort_date?.startsWith('2026')).length
    const toContact = invitations.filter(i => i.status === 'To be contacted' && i.cohort_date?.startsWith('2026')).length
    return { confirmed2026, invited, toContact, goal: 200 }
  }, [invitations])

  // Calculate cohort stats (only for active/upcoming cohorts)
  const cohortStats = useMemo(() => {
    return activeCohorts.map(cohort => {
      const cohortInvitations = invitations.filter(i =>
        i.course === cohort.course && i.region === cohort.region && i.cohort_date === cohort.date
      )
      return {
        ...cohort,
        confirmed: cohortInvitations.filter(i => i.status === 'Confirmed').length,
        invited: cohortInvitations.filter(i => i.status === 'Invited').length,
        toContact: cohortInvitations.filter(i => i.status === 'To be contacted').length,
      }
    })
  }, [invitations, activeCohorts])

  // Calculate leaderboard data (uses ALL invitations, including past cohorts)
  const leaderboardData = useMemo(() => {
    return salesReps.map(rep => {
      const repInvitations = invitations.filter(i => i.sales_rep === rep.name)
      return {
        name: rep.name,
        confirmed: repInvitations.filter(i => i.status === 'Confirmed').length,
        contacted: repInvitations.length
      }
    })
  }, [invitations, salesReps])

  const leaderboard2026 = useMemo(() => {
    return salesReps.map(rep => {
      const repInvitations = invitations.filter(i => i.sales_rep === rep.name && i.cohort_date?.startsWith('2026'))
      return {
        name: rep.name,
        confirmed: repInvitations.filter(i => i.status === 'Confirmed').length,
        contacted: repInvitations.length
      }
    })
  }, [invitations, salesReps])

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter(inv => {
      if (filterRep && inv.sales_rep !== filterRep) return false
      if (filterStatus && inv.status !== filterStatus) return false
      if (filterCourse && inv.course !== filterCourse) return false
      if (filterCohort && inv.cohort_date !== filterCohort) return false
      return true
    })
  }, [invitations, filterRep, filterStatus, filterCourse, filterCohort])

  // Add invitation
  const handleAddInvitation = async () => {
    if (!newInvitation.company || !newInvitation.name || !newInvitation.sales_rep) {
      alert('Please fill in Company, Name, and Sales Rep')
      return
    }
    const { error } = await supabase.from('invitations').insert([newInvitation])
    if (error) {
      alert('Error adding invitation: ' + error.message)
    } else {
      setNewInvitation({
        company: '', name: '', role: '', email: '', linkedin: '',
        sales_rep: '', course: '', region: '', cohort_date: '', status: 'To be contacted', notes: ''
      })
      setShowAddForm(false)
      fetchData()
    }
  }

  // Update status
  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase.from('invitations').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setInvitations(invitations.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv))
    }
  }

  // Delete invitation
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this invitation?')) return
    const { error } = await supabase.from('invitations').delete().eq('id', id)
    if (!error) {
      setInvitations(invitations.filter(inv => inv.id !== id))
    }
  }

  const courses = [...new Set(cohorts.map(c => c.course))]

  // Clear all filters
  const clearFilters = () => {
    setFilterRep('')
    setFilterStatus('')
    setFilterCourse('')
    setFilterCohort('')
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div>
            <h1>🎓 Executive Academy Tracker</h1>
            <p>Mentimeter Executive Education Program</p>
          </div>
          <nav className="nav">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
              📊 Dashboard
            </button>
            <button className={activeTab === 'invitations' ? 'active' : ''} onClick={() => setActiveTab('invitations')}>
              📋 Invitations
            </button>
            <button className={activeTab === 'leaderboard' ? 'active' : ''} onClick={() => setActiveTab('leaderboard')}>
              🏆 Leaderboards
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            {/* Goal Progress */}
            <div className="card goal-card">
              <h2>🎯 2026 Goal: 200 Executives Engaged</h2>
              <div className="goal-content">
                <div className="progress-section">
                  <div className="progress-header">
                    <span>Progress</span>
                    <span className="progress-numbers">{metrics.confirmed2026} / {metrics.goal}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(metrics.confirmed2026 / metrics.goal) * 100}%` }}></div>
                  </div>
                  <div className="progress-percent">{((metrics.confirmed2026 / metrics.goal) * 100).toFixed(1)}% complete</div>
                </div>
                <div className="stats-grid">
                  <div className="stat stat-green">
                    <div className="stat-value">{metrics.confirmed2026}</div>
                    <div className="stat-label">Confirmed</div>
                  </div>
                  <div className="stat stat-yellow">
                    <div className="stat-value">{metrics.invited}</div>
                    <div className="stat-label">Invited</div>
                  </div>
                  <div className="stat stat-blue">
                    <div className="stat-value">{metrics.toContact}</div>
                    <div className="stat-label">To Contact</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gauges - Only active/upcoming cohorts */}
            <div className="section">
              <h2>📊 Cohort Status (Active & Upcoming)</h2>
              {cohortStats.length > 0 ? (
                <div className="gauges-grid">
                  {cohortStats.map(cohort => (
                    <GaugeChart
                      key={cohort.id}
                      value={cohort.confirmed}
                      max={cohort.seats}
                      label={cohort.name}
                    />
                  ))}
                </div>
              ) : (
                <div className="card">
                  <p style={{ textAlign: 'center', color: '#64748b' }}>No upcoming cohorts. Add cohorts in the Admin panel.</p>
                </div>
              )}
            </div>

            {/* Cohort Table - Only active/upcoming cohorts */}
            <div className="card">
              <h3>📈 Cohort Details (Active & Upcoming)</h3>
              {cohortStats.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Region</th>
                      <th>Date</th>
                      <th>Seats</th>
                      <th>Confirmed</th>
                      <th>Invited</th>
                      <th>To Contact</th>
                      <th>Fill %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortStats.map(cohort => (
                      <tr key={cohort.id}>
                        <td className="font-medium">{cohort.name}</td>
                        <td><span className={`region-badge ${cohort.region.toLowerCase()}`}>{cohort.region}</span></td>
                        <td className="text-gray">{cohort.date}</td>
                        <td>{cohort.seats}</td>
                        <td className="text-green">{cohort.confirmed}</td>
                        <td className="text-yellow">{cohort.invited}</td>
                        <td className="text-blue">{cohort.toContact}</td>
                        <td className={cohort.confirmed / cohort.seats >= 0.8 ? 'text-green' : cohort.confirmed / cohort.seats >= 0.5 ? 'text-yellow' : 'text-red'}>
                          {cohort.seats > 0 ? ((cohort.confirmed / cohort.seats) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>No upcoming cohorts to display.</p>
              )}
            </div>
          </div>
        )}

        {/* Invitations */}
        {activeTab === 'invitations' && (
          <div className="invitations">
            {/* Add Invitation CTA */}
            <div className="add-invitation-cta">
              <button className="btn btn-primary btn-large" onClick={() => setShowAddForm(true)}>
                ➕ Add New Invitation
              </button>
            </div>

            {/* Filters */}
            <div className="filters-bar">
              <div className="filters">
                <div className="filter-group">
                  <label className="filter-label">Sales Rep</label>
                  <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)}>
                    <option value="">All Sales Reps</option>
                    {salesReps.map(rep => <option key={rep.id} value={rep.name}>{rep.name}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Course</label>
                  <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label">Cohort</label>
                  <select value={filterCohort} onChange={(e) => setFilterCohort(e.target.value)}>
                    <option value="">All Cohorts</option>
                    {cohorts.map(c => <option key={c.id} value={c.date}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              {(filterRep || filterStatus || filterCourse || filterCohort) && (
                <button className="btn btn-clear" onClick={clearFilters}>
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Add Form Modal */}
            {showAddForm && (
              <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>➕ Add New Invitation</h2>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Company *</label>
                      <input type="text" value={newInvitation.company} onChange={(e) => setNewInvitation({...newInvitation, company: e.target.value})} placeholder="e.g., Siemens" />
                    </div>
                    <div className="form-group">
                      <label>Name *</label>
                      <input type="text" value={newInvitation.name} onChange={(e) => setNewInvitation({...newInvitation, name: e.target.value})} placeholder="e.g., John Smith" />
                    </div>
                    <div className="form-group">
                      <label>Role</label>
                      <input type="text" value={newInvitation.role} onChange={(e) => setNewInvitation({...newInvitation, role: e.target.value})} placeholder="e.g., VP Operations" />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" value={newInvitation.email} onChange={(e) => setNewInvitation({...newInvitation, email: e.target.value})} placeholder="e.g., john@company.com" />
                    </div>
                    <div className="form-group">
                      <label>Sales Rep *</label>
                      <select value={newInvitation.sales_rep} onChange={(e) => setNewInvitation({...newInvitation, sales_rep: e.target.value})}>
                        <option value="">Select...</option>
                        {salesReps.map(rep => <option key={rep.id} value={rep.name}>{rep.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Course</label>
                      <select value={newInvitation.course} onChange={(e) => setNewInvitation({...newInvitation, course: e.target.value})}>
                        <option value="">Select...</option>
                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Region</label>
                      <select value={newInvitation.region} onChange={(e) => setNewInvitation({...newInvitation, region: e.target.value})}>
                        <option value="">Select...</option>
                        <option value="EMEA">EMEA</option>
                        <option value="NAMER">NAMER</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Cohort</label>
                      <select value={newInvitation.cohort_date} onChange={(e) => {
                        const selectedCohort = cohorts.find(c => c.date === e.target.value)
                        setNewInvitation({
                          ...newInvitation,
                          cohort_date: e.target.value,
                          course: selectedCohort?.course || newInvitation.course,
                          region: selectedCohort?.region || newInvitation.region
                        })
                      }}>
                        <option value="">Select...</option>
                        {cohorts.map(c => <option key={c.id} value={c.date}>{c.name} ({c.date})</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select value={newInvitation.status} onChange={(e) => setNewInvitation({...newInvitation, status: e.target.value})}>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <input type="text" value={newInvitation.notes} onChange={(e) => setNewInvitation({...newInvitation, notes: e.target.value})} placeholder="Optional notes..." />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button className="btn" onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleAddInvitation}>Add Invitation</button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Name</th>
                      <th>Sales Rep</th>
                      <th>Course</th>
                      <th>Cohort</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvitations.length > 0 ? (
                      filteredInvitations.map(inv => {
                        const style = statusColors[inv.status] || statusColors['To be contacted']
                        const cohortName = cohorts.find(c => c.date === inv.cohort_date)?.name || inv.cohort_date
                        return (
                          <tr key={inv.id} style={{ backgroundColor: style.bg }}>
                            <td className="font-medium">{inv.company}</td>
                            <td>{inv.name}</td>
                            <td className="text-gray">{inv.sales_rep}</td>
                            <td className="text-small">{inv.course}</td>
                            <td className="text-small">{cohortName}</td>
                            <td><span className={`region-badge ${inv.region?.toLowerCase()}`}>{inv.region}</span></td>
                            <td>
                              <select
                                value={inv.status}
                                onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                                style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
                                className="status-select"
                              >
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td>
                              <button className="btn-delete" onClick={() => handleDelete(inv.id)}>🗑️</button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No invitations found. Click "Add New Invitation" to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                Showing {filteredInvitations.length} of {invitations.length} invitations
              </div>
            </div>
          </div>
        )}

        {/* Leaderboards */}
        {activeTab === 'leaderboard' && (
          <div className="leaderboards-page">
            <div className="leaderboards-grid-full">
              <Leaderboard title="2026 Performance" data={leaderboard2026} color="green" />
              <Leaderboard title="Global - All Time" data={leaderboardData} color="purple" />
              <Leaderboard
                title="EMEA 2026"
                data={salesReps.map(rep => {
                  const repInv = invitations.filter(i => i.sales_rep === rep.name && i.region === 'EMEA' && i.cohort_date?.startsWith('2026'))
                  return { name: rep.name, confirmed: repInv.filter(i => i.status === 'Confirmed').length, contacted: repInv.length }
                })}
                color="blue"
              />
              <Leaderboard
                title="NAMER 2026"
                data={salesReps.map(rep => {
                  const repInv = invitations.filter(i => i.sales_rep === rep.name && i.region === 'NAMER' && i.cohort_date?.startsWith('2026'))
                  return { name: rep.name, confirmed: repInv.filter(i => i.status === 'Confirmed').length, contacted: repInv.length }
                })}
                color="orange"
              />
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Mentimeter Executive Academy Tracker • Built with ❤️</p>
      </footer>
    </div>
  )
}
