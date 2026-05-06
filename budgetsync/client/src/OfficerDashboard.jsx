import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ForceFieldBackground from './ForceFieldBackground';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const TOTAL_BUDGET = 100000000;
const DEPT_COLORS = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED'];
const DEPT_BG_COLORS = ['#EDE9FE','#E0F2FE','#D1FAE5','#FEF3C7','#FEE2E2','#F3E8FF'];
const DEPT_TEXT_COLORS = ['#4338CA','#0369A1','#047857','#B45309','#B91C1C','#6D28D9'];

const DEPT_DATA = [
  { id: 'agri', name: 'Agriculture', head: 'Department Head', priority: 1, colorIdx: 0 },
  { id: 'edu', name: 'Education', head: 'Department Head', priority: 2, colorIdx: 1 },
  { id: 'roads', name: 'Roadways', head: 'Department Head', priority: 2, colorIdx: 2 },
  { id: 'rail', name: 'Railways', head: 'Department Head', priority: 1, colorIdx: 3 },
  { id: 'health', name: 'Healthcare', head: 'Department Head', priority: 1, colorIdx: 4 },
];

function getDept(id) { 
  return DEPT_DATA.find(d => d.id === id) || { id: 'legacy', name: 'Legacy Dept', head: 'Former Staff', priority: 5, colorIdx: 0 }; 
}
function formatMoney(n) { return '₹' + (n / 10000000).toFixed(2) + ' Cr'; }
function formatMoneyL(n) { return '₹' + (n / 100000).toFixed(2) + ' L'; }
function formatMoneySmart(n) { 
  if (n == null) return '-';
  if (n >= 10000000) return formatMoney(n);
  if (n >= 100000) return formatMoneyL(n);
  return '₹' + (n / 1000).toFixed(0) + ' K';
}
function getInitials(name) { 
  const titles = ['dr.', 'prof.', 'mr.', 'ms.', 'mrs.', 'sir'];
  const parts = name.split(' ').filter(p => !titles.includes(p.toLowerCase().replace('.', '')));
  return parts.map(n => n[0]).join('').substring(0, 2).toUpperCase(); 
}

export default function OfficerDashboard({ appState, syncState, currentUser, onLogout, onRefresh }) {
  const [officerTab, setOfficerTab] = useState('overview');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [releaseDept, setReleaseDept] = useState('agri');
  const [releaseNote, setReleaseNote] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Auto-refresh every 5 seconds to pick up new stakeholder requests
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefresh) onRefresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  if (!appState) return <div style={{padding: 40}}>Loading Officer Dashboard...</div>;

  const totalAllocated = Object.values(appState.allocations).reduce((sum, a) => sum + a.allocated, 0);
  const remaining = TOTAL_BUDGET - totalAllocated;
  const poolPct = ((totalAllocated / TOTAL_BUDGET) * 100).toFixed(1);

  // Pending requests: departments where requested !== allocated OR status is conflict/pending
  const pendingRequests = DEPT_DATA.filter(d => {
    const a = appState.allocations[d.id] || { status: 'none', requested: 0, allocated: 0 };
    return a.status === 'conflict' || a.status === 'pending' || a.requested !== a.allocated;
  });

  const approvedDepts = DEPT_DATA.filter(d => (appState.allocations[d.id]?.status || 'none') === 'approved');

  const handleReleaseFunds = (e) => {
    e.preventDefault();
    const amount = parseInt(releaseAmount);
    if (!amount || amount <= 0) return;

    const draft = JSON.parse(JSON.stringify(appState));
    const currentAlloc = draft.allocations[releaseDept]?.allocated || 0;
    const newAlloc = currentAlloc + amount;
    const newTotal = totalAllocated + amount;

    if (newTotal > TOTAL_BUDGET) {
      alert(`Cannot release: would exceed total pool by ${formatMoneySmart(newTotal - TOTAL_BUDGET)}`);
      return;
    }

    draft.allocations[releaseDept].allocated = newAlloc;
    draft.allocations[releaseDept].status = 'approved';
    draft.auditLog.unshift({
      id: Date.now(),
      action: `Funds released by Officer`,
      dept: `${getDept(releaseDept).name} [${currentUser.uniqueId}]`,
      amount: amount,
      type: 'success',
      extra: releaseNote || 'Direct fund release',
      time: new Date().toISOString()
    });

    syncState(draft);
    setReleaseAmount('');
    setReleaseNote('');
  };

  const handleAcceptRequest = (deptId) => {
    const draft = JSON.parse(JSON.stringify(appState));
    const alloc = draft.allocations[deptId] || { requested: 0, allocated: 0, status: 'pending' };
    if (!draft.allocations[deptId]) draft.allocations[deptId] = alloc;
    const dept = getDept(deptId);
    const requested = alloc.requested;
    const currentTotal = Object.values(draft.allocations).reduce((s, a) => s + a.allocated, 0) - alloc.allocated;
    const canGrant = Math.min(requested, TOTAL_BUDGET - currentTotal);

    draft.allocations[deptId].allocated = canGrant;
    draft.allocations[deptId].status = 'approved';
    draft.allocations[deptId].actedBy = currentUser.username;
    draft.allocations[deptId].actedById = currentUser.uniqueId;

    // Remove from conflicts
    draft.conflicts = draft.conflicts.filter(c => c.deptId !== deptId);

    draft.auditLog.unshift({
      id: Date.now(),
      action: `Request APPROVED by Officer`,
      dept: `${dept.name} [${currentUser.uniqueId}]`,
      amount: canGrant,
      type: 'success',
      extra: `Granted ${formatMoneySmart(canGrant)} of ${formatMoneySmart(requested)} requested`,
      time: new Date().toISOString()
    });

    syncState(draft);
  };

  const handleDeclineRequest = (deptId) => {
    const draft = JSON.parse(JSON.stringify(appState));
    const dept = getDept(deptId);
    const alloc = draft.allocations[deptId] || { requested: 0, allocated: 0, status: 'pending' };
    if (!draft.allocations[deptId]) draft.allocations[deptId] = alloc;

    draft.allocations[deptId].status = 'rejected';
    draft.allocations[deptId].requested = alloc.allocated;
    draft.allocations[deptId].actedBy = currentUser.username;
    draft.allocations[deptId].actedById = currentUser.uniqueId;

    // Remove from conflicts
    draft.conflicts = draft.conflicts.filter(c => c.deptId !== deptId);

    draft.auditLog.unshift({
      id: Date.now(),
      action: `Request DECLINED by Officer`,
      dept: `${dept.name} [${currentUser.uniqueId}]`,
      amount: 0,
      type: 'danger',
      extra: `Declined request for ${formatMoneySmart(alloc.requested)}`,
      time: new Date().toISOString()
    });

    syncState(draft);
  };

  const tabs = ['overview', 'analytics', 'requests', 'release', 'audit'];

  return (
    <div className="dark-theme dashboard-container" style={{ position: 'relative', minHeight: '100vh', background: 'var(--color-background-secondary)', overflow: 'hidden' }}>
      {/* Dynamic Background Animation */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.6 }}>
        <ForceFieldBackground 
          hue={196} 
          saturation={100} 
          spacing={18} 
          density={1.2}
          forceStrength={8}
          magnifierRadius={160}
          minStroke={1.5}
          maxStroke={3.5}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header>
        <div className="logo-area">
          <div className="logo">BS</div>
          <div>
            <h1 className="app-title">BudgetSync</h1>
            <div className="app-subtitle">Disbursing Officer Control Panel</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" style={{ marginRight: 8 }} onClick={onRefresh}>🔄 Refresh</button>
          
          <div style={{ position: 'relative' }}>
            <div 
              className="user-profile-trigger" 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 12px', 
                borderRadius: 20, background: 'rgba(0,0,0,0.05)', transition: 'all 0.2s' 
              }}
            >
              <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{getInitials(currentUser.username)}</div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser.username}</span>
            </div>

            {showProfileDropdown && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                  onClick={() => setShowProfileDropdown(false)}
                />
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="avatar" style={{ width: 56, height: 56, fontSize: '1.5rem', marginBottom: 12, border: '3px solid rgba(255,255,255,0.1)' }}>
                      {getInitials(currentUser.username)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentUser.username}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{currentUser.email || 'officer@budgetsync.in'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 8, fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 10px', borderRadius: 10 }}>
                      ID: {currentUser.uniqueId || 'OFF-2026-A1B2'}
                    </div>
                  </div>
                  
                  <div className="profile-dropdown-body">
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>🔐</span>
                      <span>Security & Permissions</span>
                    </div>
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>🏦</span>
                      <span>Officer Settings</span>
                    </div>
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>📋</span>
                      <span>Audit Preferences</span>
                    </div>
                    
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />
                    
                    <div className="dropdown-item" onClick={onLogout} style={{ color: '#ff4d4d' }}>
                      <span style={{ fontSize: '1.2rem' }}>🚪</span>
                      <span>Sign out</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="tabs-nav">
        {tabs.map(t => (
          <button key={t} className={`tab-btn ${officerTab === t ? 'active' : ''}`} onClick={() => setOfficerTab(t)}>
            {t === 'overview' ? '📊 Overview' : t === 'analytics' ? '📈 Analytics' : t === 'requests' ? '📨 Requests' : t === 'release' ? '💰 Release' : '📋 Audit'}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      <main className="tab-content" style={{ display: officerTab === 'overview' ? 'block' : 'none' }}>
        <div className="metric-grid" style={{ marginBottom: 24 }}>
          <div className="card metric-card">
            <div className="metric-label">Total Pool</div>
            <div className="metric-value">{formatMoney(TOTAL_BUDGET)}</div>
          </div>
          <div className="card metric-card">
            <div className="metric-label">Total Allocated</div>
            <div className="metric-value">{formatMoneySmart(totalAllocated)}</div>
          </div>
          <div className="card metric-card">
            <div className="metric-label">Remaining</div>
            <div className="metric-value" style={{ color: remaining < 500000 ? '#DC2626' : '#059669' }}>{formatMoneySmart(Math.max(0, remaining))}</div>
          </div>
          <div className="card metric-card">
            <div className="metric-label">Pending Requests</div>
            <div className="metric-value" style={{ color: pendingRequests.length > 0 ? '#D97706' : '#059669' }}>{pendingRequests.length}</div>
          </div>
        </div>

        <div className="grid-2col">
          <div className="card">
            <h3>Department Allocations</h3>
            <div className="pool-bar-container" style={{ marginBottom: 16 }}>
              {DEPT_DATA.map(dept => {
                let alloc = appState.allocations[dept.id]?.allocated || 0;
                if (alloc === 0) return null;
                let pct = (alloc / TOTAL_BUDGET) * 100;
                return <div key={dept.id} className="pool-segment" style={{width: `${pct}%`, background: DEPT_COLORS[dept.colorIdx]}} title={`${dept.name}: ${formatMoneySmart(alloc)}`}></div>;
              })}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Requested</th>
                  <th>Allocated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DEPT_DATA.map(dept => {
                  const alloc = appState.allocations[dept.id] || { requested: 0, allocated: 0, status: 'pending' };
                  return (
                    <tr key={dept.id} className={alloc.status === 'conflict' ? 'row-conflict' : ''}>
                      <td>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <div className="avatar" style={{width:28, height:28, fontSize:'0.65rem', background: DEPT_BG_COLORS[dept.colorIdx], color: DEPT_TEXT_COLORS[dept.colorIdx]}}>
                            {getInitials(dept.head)}
                          </div>
                          <div>
                            <div style={{fontWeight:500}}>{dept.name}</div>
                            <div style={{fontSize:'0.7rem', color:'var(--color-text-secondary)'}}>
                              {alloc.submittedBy ? `${alloc.submittedBy} [${alloc.submittedById || 'N/A'}]` : `Head: ${dept.head}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatMoneySmart(alloc.requested)}</td>
                      <td style={{fontWeight:600}}>{formatMoneySmart(alloc.allocated)}</td>
                      <td><span className={`chip ${alloc.status}`}>{alloc.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Recent Activity</h3>
            <div>
              {appState.auditLog.slice(0, 10).map((l, i) => (
                <div key={i} className="feed-item">
                  <div className={`feed-dot bg-${l.type}`}></div>
                  <div className="feed-content">
                    <p className="feed-title">{l.action}</p>
                    <p className="feed-desc">{l.dept} {l.amount ? `· ${formatMoneySmart(l.amount)}` : ''}</p>
                    <p className="feed-time">{new Date(l.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(l.time).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ─── REQUESTS TAB ─── */}
      <main className="tab-content" style={{ display: officerTab === 'requests' ? 'block' : 'none' }}>
        <div className="single-col">
          <div className="card">
            <h3>📨 Pending Stakeholder Requests</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Review and approve or decline budget requests from department stakeholders.
            </p>

            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: '0.9rem' }}>All requests have been processed. No pending items.</div>
              </div>
            ) : (
              pendingRequests.map(dept => {
                const alloc = appState.allocations[dept.id] || { requested: 0, allocated: 0, status: 'pending' };
                const gap = alloc.requested - alloc.allocated;
                const maxCanGrant = Math.min(alloc.requested, remaining + alloc.allocated);

                return (
                  <div key={dept.id} style={{
                    border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16,
                    borderLeft: `4px solid ${DEPT_COLORS[dept.colorIdx]}`, background: 'var(--color-background-primary)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="avatar" style={{ width: 40, height: 40, background: DEPT_BG_COLORS[dept.colorIdx], color: DEPT_TEXT_COLORS[dept.colorIdx] }}>
                          {getInitials(alloc.submittedBy || dept.head)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{dept.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                            {alloc.submittedBy ? (
                              <>
                                <div>Submitted by: <strong>{alloc.submittedBy}</strong></div>
                                <div style={{ 
                                  display: 'inline-block',
                                  marginTop: 4,
                                  padding: '2px 8px', 
                                  background: 'rgba(16, 185, 129, 0.15)', 
                                  color: '#10b981', 
                                  borderRadius: '12px', 
                                  fontSize: '0.65rem', 
                                  fontWeight: 600,
                                  border: '1px solid rgba(16, 185, 129, 0.2)'
                                }}>
                                  ID: {alloc.submittedById || 'STK-PENDING'}
                                </div>
                              </>
                            ) : (
                              <div>Head: {dept.head}</div>
                            )}
                            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Priority: P{dept.priority}</div>
                          </div>
                        </div>
                      </div>
                      <span className={`chip ${alloc.status}`}>{alloc.status}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16, padding: 12, background: 'var(--color-background-secondary)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Requested</div>
                        <div style={{ fontWeight: 600, color: '#D97706' }}>{formatMoneySmart(alloc.requested)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Currently Allocated</div>
                        <div style={{ fontWeight: 600 }}>{formatMoneySmart(alloc.allocated)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Funding Gap</div>
                        <div style={{ fontWeight: 600, color: gap > 0 ? '#DC2626' : '#059669' }}>{gap > 0 ? '+' : ''}{formatMoneySmart(gap)}</div>
                      </div>
                    </div>

                    {alloc.justification && (
                      <div style={{ fontSize: '0.85rem', padding: 10, background: '#FEF3C7', borderRadius: 6, marginBottom: 16, borderLeft: '3px solid #D97706' }}>
                        <strong>Justification:</strong> "{alloc.justification}"
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '10px 16px' }} onClick={() => handleAcceptRequest(dept.id)}>
                        ✅ Accept (Grant {formatMoneySmart(maxCanGrant)})
                      </button>
                      <button className="btn" style={{ flex: 1, padding: '10px 16px', color: '#DC2626', borderColor: '#DC2626' }} onClick={() => handleDeclineRequest(dept.id)}>
                        ❌ Decline Request
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ─── RELEASE FUNDS TAB ─── */}
      <main className="tab-content" style={{ display: officerTab === 'release' ? 'block' : 'none' }}>
        <div className="grid-2col">
          <div className="card">
            <h3>💰 Release Funds to Department</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Directly release funds from the central pool to a specific department.
            </p>

            <div style={{ padding: 16, background: remaining < 500000 ? '#FEF2F2' : '#F0FDF4', borderRadius: 8, marginBottom: 20, border: `1px solid ${remaining < 500000 ? '#FCA5A5' : '#BBF7D0'}` }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Available in Pool</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: remaining < 500000 ? '#DC2626' : '#059669' }}>{formatMoneySmart(Math.max(0, remaining))}</div>
            </div>

            <form onSubmit={handleReleaseFunds}>
              <div className="form-group">
                <label>Select Department</label>
                <select className="form-control" value={releaseDept} onChange={e => setReleaseDept(e.target.value)}>
                  {DEPT_DATA.map(d => (
                    <option key={d.id} value={d.id}>{d.name} — Currently: {formatMoneySmart(appState.allocations[d.id]?.allocated || 0)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount to Release (₹)</label>
                <input type="number" className="form-control" value={releaseAmount} onChange={e => setReleaseAmount(e.target.value)}
                  min="1000" step="1000" max={remaining} placeholder="e.g. 500000" required />
              </div>
              <div className="form-group">
                <label>Release Note (Optional)</label>
                <input type="text" className="form-control" value={releaseNote} onChange={e => setReleaseNote(e.target.value)}
                  placeholder="e.g. Emergency Q3 server budget" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px 16px' }}>
                Release Funds
              </button>
            </form>
          </div>

          <div className="card">
            <h3>Current Fund Distribution</h3>
            {DEPT_DATA.map(dept => {
              const alloc = appState.allocations[dept.id];
              const pct = (alloc.allocated / TOTAL_BUDGET) * 100;
              return (
                <div key={dept.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: DEPT_COLORS[dept.colorIdx] }}></div>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                        {dept.name} 
                        {alloc.submittedBy && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                            ({alloc.submittedBy}) <span style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>[{alloc.submittedById || 'STK-PENDING'}]</span>
                          </span>
                        )}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formatMoneySmart(alloc.allocated)}</span>
                  </div>
                  <div className="util-bar">
                    <div className="util-fill" style={{ width: `${pct}%`, background: DEPT_COLORS[dept.colorIdx] }}></div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{pct.toFixed(1)}% of total pool</div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ─── ANALYTICS TAB ─── */}
      <main className="tab-content" style={{ display: officerTab === 'analytics' ? 'block' : 'none' }}>
        <div className="single-col">
          <div className="grid-2col">
            <div className="card">
              <h3>📈 Resource Allocation Analysis</h3>
              <div style={{ height: 350 }}>
                <Bar 
                  data={{
                    labels: DEPT_DATA.map(d => d.name),
                    datasets: [
                      {
                        label: 'Requested',
                        data: DEPT_DATA.map(d => appState.allocations[d.id]?.requested || 0),
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                      },
                      {
                        label: 'Allocated',
                        data: DEPT_DATA.map(d => appState.allocations[d.id]?.allocated || 0),
                        backgroundColor: DEPT_DATA.map(d => DEPT_COLORS[d.colorIdx]),
                        borderRadius: 4,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)', callback: value => '₹' + value/100000 + 'L' }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                      }
                    },
                    plugins: {
                      legend: { labels: { color: '#fff' } }
                    }
                  }}
                />
              </div>
            </div>

            <div className="card">
              <h3>🍰 Budget Utilization</h3>
              <div style={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                <Doughnut 
                  data={{
                    labels: [...DEPT_DATA.map(d => d.name), 'Remaining'],
                    datasets: [{
                      data: [...DEPT_DATA.map(d => appState.allocations[d.id]?.allocated || 0), remaining],
                      backgroundColor: [...DEPT_DATA.map(d => DEPT_COLORS[d.colorIdx]), 'rgba(255, 255, 255, 0.05)'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { color: '#fff', boxWidth: 12, padding: 15, font: { size: 10 } } }
                    },
                    cutout: '70%'
                  }}
                />
              </div>
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{poolPct}%</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Total Utilization</div>
              </div>
            </div>
          </div>

          <div className="metric-grid" style={{ marginTop: 24 }}>
            <div className="card metric-card">
              <div className="metric-label">Avg. Approval Rate</div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                { (DEPT_DATA.reduce((acc, d) => {
                  const a = appState.allocations[d.id];
                  return acc + (a?.requested > 0 ? (a.allocated / a.requested) : 1);
                }, 0) / DEPT_DATA.length * 100).toFixed(1) }%
              </div>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Pending Conflicts</div>
              <div className="metric-value" style={{ color: '#f59e0b' }}>
                {DEPT_DATA.filter(d => appState.allocations[d.id]?.status === 'conflict').length}
              </div>
            </div>
            <div className="card metric-card">
              <div className="metric-label">System Health</div>
              <div className="metric-value" style={{ color: '#3b82f6' }}>Optimal</div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── AUDIT LOG TAB ─── */}
      <main className="tab-content" style={{ display: officerTab === 'audit' ? 'block' : 'none' }}>
        <div className="single-col">
          <div className="card">
            <h3>📋 Officer Audit Trail</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Department</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {appState.auditLog.map((l, i) => (
                  <tr key={i}>
                    <td>{new Date(l.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(l.time).toLocaleTimeString()}</td>
                    <td><span className={`chip ${l.type === 'success' ? 'approved' : (l.type === 'danger' ? 'conflict' : l.type)}`}>{l.action}</span></td>
                    <td>{l.dept}</td>
                    <td>{l.amount ? formatMoneySmart(l.amount) : '-'}</td>
                    <td>{l.extra || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
