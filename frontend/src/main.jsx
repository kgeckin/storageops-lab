import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_STORAGEOPS_API || 'http://127.0.0.1:8000';
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

async function readJson(path, signal) {
  const response = await fetch(API + path, { signal });
  if (!response.ok) throw new Error('API returned HTTP ' + response.status);
  return response.json();
}

function Icon({ name }) {
  const paths = {
    storage: <><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></>,
    activity: <path d="M2 12h4l3-8 6 16 3-8h4"/>,
    alert: <><path d="m12 2 10 18H2L12 2Z"/><path d="M12 9v4m0 4h.01"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 16-5l2 2"/><path d="M21 3v6h-6"/><path d="M21 12a9 9 0 0 1-16 5l-2-2"/><path d="M3 21v-6h6"/></>,
  };
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Tile({ title, value, unit, icon, hint }) {
  return <div className="tile">
    <div className="tile-heading"><span>{title}</span><Icon name={icon}/></div>
    <div className="tile-value">{value}<span className="tile-unit">{unit}</span></div>
    <p>{hint}</p>
  </div>;
}

function TrendChart({ points, measure }) {
  const values = points.map(item => measure === 'iops' ? item.performance.iops : item.performance.latency_ms);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);
  const width = 720, height = 208;
  const x = index => 18 + index * (width - 36) / Math.max(1, points.length - 1);
  const y = value => 22 + (1 - (value - minimum) / range) * (height - 50);
  const path = values.map((value, index) => (index ? 'L' : 'M') + x(index).toFixed(1) + ',' + y(value).toFixed(1)).join(' ');
  const area = path + ' L' + x(points.length - 1).toFixed(1) + ',' + (height - 14) + ' L' + x(0).toFixed(1) + ',' + (height - 14) + ' Z';
  return <div className="chart-wrap">
    <svg className="chart" viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={'Synthetic ' + measure + ' history for ' + points.length + ' samples'}>
      <defs><linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#d6bb8b" stopOpacity=".25"/><stop offset="1" stopColor="#d6bb8b" stopOpacity=".01"/></linearGradient></defs>
      {[0,1,2,3].map(number => <line key={number} x1="18" x2={width-18} y1={22+number*47} y2={22+number*47} stroke="#3a404b" strokeDasharray="4 7"/>)}
      <path d={area} fill="url(#chartFade)"/>
      <path d={path} fill="none" stroke="#e3cb9d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={x(points.length-1)} cy={y(values.at(-1))} r="5" fill="#f4e6cb"/>
    </svg>
    <div className="chart-axis"><span>{points[0].at.substring(11,16)} UTC</span><span>{points.at(-1).at.substring(11,16)} UTC</span></div>
  </div>;
}

function App() {
  const [overview, setOverview] = useState(null);
  const [activeId, setActiveId] = useState('array-a');
  const [history, setHistory] = useState([]);
  const [measure, setMeasure] = useState('iops');
  const [pointsCount, setPointsCount] = useState(24);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async signal => {
    try {
      const data = await readJson('/api/v1/overview', signal);
      setOverview(data);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError('Cannot connect to local lab API: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const interval = setInterval(() => refresh(controller.signal), 30000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    readJson('/api/v1/arrays/' + activeId + '/history?points=' + pointsCount, controller.signal)
      .then(data => setHistory(data.points))
      .catch(err => { if (err.name !== 'AbortError') setError('History request failed: ' + err.message); });
    return () => controller.abort();
  }, [activeId, pointsCount, updatedAt]);

  const active = useMemo(() => overview?.arrays?.find(array => array.id === activeId), [overview, activeId]);
  const summary = overview?.summary;
  const alerts = overview?.alerts ?? [];
  const selectedAlerts = alerts.filter(alert => alert.array_id === activeId);

  return <div className="app">
    <aside className="sidebar" aria-label="Lab navigation">
      <div className="identity"><span className="identity-mark">KG.</span><span className="identity-text">ENGINEERING LABS</span></div>
      <div className="nav-section">OVERVIEW</div>
      <a className="nav-item selected" href="#dashboard"><Icon name="activity"/>Dashboard</a>
      <a className="nav-item" href="#arrays"><Icon name="storage"/>Storage arrays</a>
      <a className="nav-item" href="#alerts"><Icon name="alert"/>Alert events <span className="nav-count">{alerts.length}</span></a>
      <div className="sidebar-bottom"><span className="status-dot"/>Simulator online<br/><small>LAB DATA ONLY · v0.1</small></div>
    </aside>
    <main className="main" id="dashboard">
      <header className="main-header">
        <div><div className="eyebrow">STORAGE / OBSERVABILITY</div><h1>Operations overview</h1><p className="subtitle">Synthetic metrics and explainable threshold alerts.</p></div>
        <button className="refresh" type="button" onClick={() => refresh()}><Icon name="refresh"/>Refresh data</button>
      </header>
      <div className="notice"><strong>SIMULATION MODE</strong><span>No production systems, customer data or vendor APIs are connected.</span></div>
      {error && <div className="error" role="alert">{error}<br/><small>Start FastAPI on http://127.0.0.1:8000.</small></div>}
      <div className="metrics">
        <Tile title="Storage arrays" icon="storage" value={loading ? '…' : (summary?.array_count ?? '—')} unit=" arrays" hint="Fictional lab devices"/>
        <Tile title="Capacity used" icon="storage" value={summary ? fmt.format(summary.capacity_used_tb) : '—'} unit=" TB" hint={summary ? summary.utilization_pct + '% of ' + summary.capacity_total_tb + ' TB' : 'Waiting for API'}/>
        <Tile title="Total IOPS" icon="activity" value={summary ? fmt.format(summary.total_iops) : '—'} unit=" ops/s" hint="Estimated synthetic workload"/>
        <Tile title="Open alerts" icon="alert" value={summary ? summary.alert_count : '—'} unit=" alerts" hint="Threshold observations"/>
      </div>
      <div className="columns">
        <section className="panel device-panel" id="arrays">
          <div className="panel-head"><div><p className="eyebrow">INVENTORY</p><h2>Lab arrays</h2></div><span className="muted">SELECT A DEVICE</span></div>
          <div className="device-list">
            {(overview?.arrays ?? []).map(device => <button key={device.id} type="button" aria-pressed={activeId === device.id}
              className={'device ' + (activeId === device.id ? 'active' : '')} onClick={() => setActiveId(device.id)}>
              <div className="device-icon"><Icon name="storage"/></div><div className="device-info"><strong>{device.name}</strong><small>{device.workload}</small></div>
              <div className="device-usage">{device.capacity.utilization_pct}%</div>
            </button>)}
          </div>
        </section>
        <section className="panel trend-panel">
          <div className="panel-head">
            <div><p className="eyebrow">PERFORMANCE</p><h2>{active?.name ?? 'Select an array'} trend</h2></div>
            <div className="compact-controls">
              <label><span className="sr-only">Metric</span><select value={measure} onChange={event => setMeasure(event.target.value)}><option value="iops">IOPS</option><option value="latency">Latency</option></select></label>
              <label><span className="sr-only">Window</span><select value={pointsCount} onChange={event => setPointsCount(Number(event.target.value))}><option value={12}>3 hours</option><option value={24}>6 hours</option><option value={48}>12 hours</option></select></label>
            </div>
          </div>
          {history.length ? <TrendChart points={history} measure={measure}/> : <div className="empty">History is loading…</div>}
          <div className="trend-footer"><span>{active ? fmt.format(active.performance.iops) + ' IOPS · ' + active.performance.latency_ms + ' ms latency' : ''}</span><span>{history.length} samples · 15 min interval</span></div>
        </section>
      </div>
      <section className="panel alert-panel" id="alerts">
        <div className="panel-head"><div><p className="eyebrow">DIAGNOSTICS</p><h2>Active alerts</h2></div><span className="muted">{selectedAlerts.length} on selected array</span></div>
        <div className="alerts">{alerts.length ? alerts.map(alert => <div className="alert-item" key={alert.id}>
          <span className={'severity ' + alert.severity}>{alert.severity}</span><span>{alert.message}</span><small>{alert.array_id}</small>
        </div>) : <div className="empty">No alerts. Capacity ≥ 80%, latency ≥ 5 ms.</div>}</div>
      </section>
      <footer>KG / StorageOps Lab · <a href={API + '/docs'}>API reference</a> · <a href={API + '/metrics'}>Prometheus metrics</a> · Last refresh {updatedAt ? updatedAt.toLocaleTimeString() : 'pending'}</footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
