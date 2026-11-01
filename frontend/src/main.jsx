import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { palette, short, pct, gb, timestamp, areaOption, capacityOption, compareOption, heatmapOption, severityOption, useColorsDummy, baseAxes } from './charts.js';
import { Glyph, Chart, Sparkline, Panel, Topology, CSVButton } from './components.jsx';
import './styles.css';

const API = import.meta.env.VITE_STORAGEOPS_API || '';
const SECTIONS = ['Overview', 'Storage arrays', 'Host telemetry', 'Performance', 'Incidents'];

async function getJSON(path, signal) {
  const response = await fetch(API + path, { signal });
  if (!response.ok) throw Error('HTTP ' + response.status + ': ' + path);
  return response.json();
}

function App() {
  const [section, setSection] = useState('Overview');
  const [theme, setTheme] = useState(() => localStorage.getItem('storageops-theme') === 'light' ? 'light' : 'dark');
  const [overview, setOverview] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [selectedArray, setSelectedArray] = useState('array-a');
  const [selectedHost, setSelectedHost] = useState('');
  const [history, setHistory] = useState({});
  const [hostHistory, setHostHistory] = useState([]);
  const [windowSize, setWindowSize] = useState(24);
  const [metric, setMetric] = useState('iops');
  const [comparison, setComparison] = useState('capacity');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [auto, setAuto] = useState(true);
  const [sync, setSync] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('storageops-theme', theme);
  }, [theme]);

  const refresh = useCallback(async signal => {
    try {
      const [next, fleet] = await Promise.all([getJSON('/api/v1/overview', signal), getJSON('/api/v1/hosts', signal)]);
      setOverview(next); setHosts(fleet); setSync(new Date());
      setError('');
    } catch (e) { if (e.name !== 'AbortError') setError('API unavailable. ' + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    if (!auto) return () => controller.abort();
    const id = setInterval(() => refresh(controller.signal), 30000);
    return () => { controller.abort(); clearInterval(id); };
  }, [refresh, auto]);

  useEffect(() => {
    if (!overview) return;
    const controller = new AbortController();
    Promise.all(overview.arrays.map(a => getJSON('/api/v1/arrays/' + a.id + '/history?points=' + windowSize, controller.signal).then(r => [a.id, r.points])))
      .then(v => setHistory(Object.fromEntries(v)))
      .catch(e => { if (e.name !== 'AbortError') setError('History unavailable: ' + e.message); });
    return () => controller.abort();
  }, [overview, windowSize]);

  useEffect(() => {
    if (!hosts.length) { setSelectedHost(''); setHostHistory([]); return; }
    if (!hosts.some(h => h.host_id === selectedHost)) setSelectedHost(hosts[0].host_id);
  }, [hosts, selectedHost]);

  useEffect(() => {
    if (!selectedHost) return;
    const controller = new AbortController();
    getJSON('/api/v1/hosts/' + encodeURIComponent(selectedHost) + '/history?points=120', controller.signal)
      .then(r => setHostHistory(r.points))
      .catch(e => { if (e.name !== 'AbortError') setError('Host history unavailable: ' + e.message); });
    return () => controller.abort();
  }, [selectedHost, sync]);

  useEffect(() => {
    function escape(e) { if (e.key === 'Escape') setDrawer(false); }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);

  const arrays = overview?.arrays || [];
  const summary = overview?.summary || {};
  const alerts = overview?.alerts || [];
  const current = arrays.find(a => a.id === selectedArray) || arrays[0];
  const selectedSamples = current ? history[current.id] || [] : [];
  const selectedHostData = hosts.find(h => h.host_id === selectedHost);
  const filteredArrays = arrays.filter(a => (a.name + ' ' + a.workload).toLowerCase().includes(search.toLowerCase()));
  const allEvents = arrays.flatMap(a => (history[a.id] || []).filter(point =>
    point.capacity.utilization_pct >= 80 || point.performance.latency_ms >= 5
  ).map(point => ({
    id: a.id + point.at, host: a.name, time: point.at,
    type: point.capacity.utilization_pct >= 80 ? 'Capacity threshold' : 'Latency threshold',
    severity: point.capacity.utilization_pct >= 90 || point.performance.latency_ms >= 8 ? 'critical' : 'warning',
    detail: point.capacity.utilization_pct >= 80 ? pct(point.capacity.utilization_pct) + ' used' : point.performance.latency_ms + ' ms'
  }))).sort((a,b) => b.time.localeCompare(a.time)).slice(0, 50);
  const realHostCount = hosts.filter(h => h.status === 'online').length;
  const metricRows = selectedSamples.map(s => ({ time: s.at, array: current.name, iops: s.performance.iops, latency_ms: s.performance.latency_ms, throughput_mbps: s.performance.throughput_mbps, used_percent: s.capacity.utilization_pct }));
  const hostRows = hostHistory.map(p => ({ time: p.received_at, host: p.host_id, cpu_percent: p.cpu_percent, memory_percent: p.memory.percent, disk_percent: p.disk.percent, network_received_bytes: p.network.received_bytes, network_sent_bytes: p.network.sent_bytes }));

  const hostLine = (field, title, color) => {
    const colors = useColorsDummy(theme);
    return {
      grid: { left: 52, right: 16, top: 25, bottom: 42 },
      tooltip: { trigger: 'axis', valueFormatter: value => pct(value) },
      xAxis: { type: 'category', boundaryGap: false, data: hostHistory.map(p => timestamp(p.received_at)), ...baseAxes(colors), splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, ...baseAxes(colors) },
      series: [{ type: 'line', name: title, data: hostHistory.map(p => field === 'cpu' ? p.cpu_percent : p[field].percent), smooth: true, showSymbol: hostHistory.length === 1, symbolSize: 8,
        lineStyle: { color, width: 3 }, areaStyle: { opacity: .12, color }, emphasis: { focus: 'series' } }]
    };
  };

  return <div className="shell">
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand"><div className="brand-icon"><Glyph name="layers" size={23}/></div><div><b>StorageOps</b><small>CONTROL CENTER / 02</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav">
        {SECTIONS.map((name, i) => <button key={name} type="button" className={section === name ? 'nav-link active' : 'nav-link'} onClick={() => { setSection(name); setDrawer(false); }}>
          <Glyph name={['grid','server','cpu','chart','bell'][i]} size={19}/><span>{name}</span>
          {name === 'Incidents' && !!alerts.length && <em>{alerts.length}</em>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="env-indicator"><i/><strong>LOCAL LAB</strong><span>Simulation + opt-in hosts</span></div>
        <div className="sidebar-note">No production storage connected. Real host readings are labeled separately.</div>
        <a href="https://github.com/kgeckin/storageops-lab" target="_blank" rel="noreferrer" className="github-link">View repository <Glyph name="arrow" size={15}/></a>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb">WORKSPACE <Glyph name="chevron" size={14}/> <span>{section.toUpperCase()}</span></div>
        <div className="top-actions">
          <span className="live-pill"><i/>{auto ? 'AUTO REFRESH · 30 SEC' : 'REFRESH PAUSED'}</span>
          <button aria-label={auto ? 'Pause automatic refresh' : 'Resume automatic refresh'} title={auto ? 'Pause auto refresh' : 'Resume auto refresh'} className="icon-button" onClick={() => setAuto(!auto)}><Glyph name={auto ? 'pause' : 'play'} size={17}/></button>
          <button aria-label="Refresh dashboard" title="Refresh" className="icon-button" onClick={() => refresh()}><Glyph name="refresh" size={18}/></button>
          <button aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle appearance" className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Glyph name={theme === 'dark' ? 'sun' : 'moon'} size={18}/></button>
        </div>
      </header>
      <div className="content">
        <div className="page-head">
          <div><div className="eyebrow">OBSERVABILITY PLATFORM / V2</div><h1>{section === 'Overview' ? 'Infrastructure overview' : section}</h1><p>Telemetry with context. A clear view of systems, health and performance.</p></div>
          <div className="page-tools"><span className="last-updated">Updated {sync ? sync.toLocaleTimeString() : 'pending'}</span><select aria-label="Chart history window" value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}><option value="12">Last 3 hours</option><option value="24">Last 6 hours</option><option value="48">Last 12 hours</option><option value="96">Last 24 hours</option></select></div>
        </div>
        {error && <div className="error-banner" role="alert"><Glyph name="bell"/><div><b>Connection issue</b><span>{error}. Check the local API at port 8000.</span></div><button onClick={() => setError('')} aria-label="Dismiss error"><Glyph name="close" size={18}/></button></div>}
        <div className="scope-banner"><Glyph name="shield" size={19}/><b>LAB SCOPE</b><span>Storage metrics are simulated. Host telemetry is measured locally only after an authorized agent reports.</span><span className="scope-status">ISOLATED</span></div>

        {section === 'Overview' && <>
          <div className="kpi-grid">
            <div className="kpi"><span className="kpi-title"><Glyph name="server" size={18}/> STORAGE ESTATE</span><div className="kpi-main">{loading ? '…' : arrays.length}<small> arrays</small></div><span className="kpi-foot">Synthetic infrastructure</span><Sparkline points={selectedSamples}/></div>
            <div className="kpi"><span className="kpi-title"><Glyph name="layers" size={18}/> CAPACITY USED</span><div className="kpi-main">{summary.capacity_used_tb == null ? '—' : short(summary.capacity_used_tb)}<small> TB</small></div><span className="kpi-foot">{pct(summary.utilization_pct)} of {short(summary.capacity_total_tb)} TB</span><div className="kpi-progress"><span style={{ width: (summary.utilization_pct || 0) + '%' }}/></div></div>
            <div className="kpi"><span className="kpi-title"><Glyph name="wave" size={18}/> TOTAL IOPS</span><div className="kpi-main">{summary.total_iops == null ? '—' : short(summary.total_iops)}</div><span className="kpi-foot">Simulated operations / sec</span><Sparkline points={selectedSamples} color={palette.teal}/></div>
            <div className="kpi"><span className="kpi-title"><Glyph name="bell" size={18}/> ACTIVE ALERTS</span><div className="kpi-main">{summary.alert_count ?? '—'}</div><span className="kpi-foot">Current threshold breaches</span><span className="kpi-status"><i/> Policy evaluation active</span></div>
            <div className="kpi actual-kpi"><span className="kpi-title"><Glyph name="cpu" size={18}/> REAL HOSTS</span><div className="kpi-main">{realHostCount}<small> online</small></div><span className="kpi-foot">{hosts.length ? hosts.length + ' registered host(s) reporting' : 'Awaiting your Windows agent'}</span><button className="kpi-link" onClick={() => setSection('Host telemetry')}>View live hosts <Glyph name="arrow" size={14}/></button></div>
          </div>
          <div className="two-col wide-right">
            <Panel eyebrow="CAPACITY MANAGEMENT" title="Storage utilization" action={<span className="tag neutral">SYNTHETIC</span>}>
              <div className="donut-composition"><Chart theme={theme} label="Capacity usage donut chart" option={capacityOption(summary.capacity_used_tb || 0, summary.capacity_total_tb || 1, theme)} height={213}/><div className="donut-center"><b>{pct(summary.utilization_pct)}</b><span>allocated</span></div></div>
              <div className="legend-row"><span><i className="legend used"/>Used · {short(summary.capacity_used_tb)} TB</span><span><i className="legend free"/>Available · {short((summary.capacity_total_tb || 0) - (summary.capacity_used_tb || 0))} TB</span></div>
            </Panel>
            <Panel eyebrow="PERFORMANCE ANALYSIS" title={current?.name + ' performance' || 'Array performance'} action={<select aria-label="Performance metric" value={metric} onChange={e => setMetric(e.target.value)}><option value="iops">IOPS</option><option value="latency_ms">Latency</option><option value="throughput_mbps">Throughput</option><option value="capacity">Capacity %</option></select>}>
              <Chart theme={theme} option={areaOption(selectedSamples, metric, theme)} label={'Historical simulated ' + metric} height={235}/>
              <div className="mini-stat-row"><span>{selectedSamples.length} readings</span><span>15 min intervals</span><CSVButton rows={metricRows} filename="storageops-array-history.csv" title="Export data"/></div>
            </Panel>
          </div>
          <div className="two-col">
            <Panel eyebrow="STORAGE INVENTORY" title="Monitored arrays" action={<button className="text-button" onClick={() => setSection('Storage arrays')}>Explore all <Glyph name="arrow" size={15}/></button>}>
              <div className="array-list">{arrays.map(a => <button className={'array-row ' + (selectedArray === a.id ? 'selected' : '')} key={a.id} onClick={() => { setSelectedArray(a.id); setDrawer(true); }}>
                <span className="device-glyph"><Glyph name="server"/></span><span className="array-label"><b>{a.name}</b><small>{a.workload}</small></span><span className="array-side"><b>{pct(a.capacity.utilization_pct)}</b><small>{short(a.performance.iops)} IOPS</small></span><Glyph name="chevron" size={16}/></button>)}</div>
            </Panel>
            <Panel eyebrow="EVENTS & THRESHOLDS" title="Active observations" action={<span className="tag">{alerts.length} OPEN</span>}>
              <div className="alerts-list">{alerts.length ? alerts.map(a => <div className="alert-row" key={a.id}><span className={'severity-marker ' + a.severity}><Glyph name="bell" size={16}/></span><div><b>{a.type === 'capacity' ? 'Capacity threshold' : 'Latency threshold'}</b><p>{a.message}</p></div><span className={'tag ' + a.severity}>{a.severity}</span></div>) : <div className="empty-state"><Glyph name="shield" size={31}/><b>No active alerts</b><p>Current measurements are within the configured thresholds.</p></div>}</div>
            </Panel>
          </div>
          <div className="two-col">
            <Panel eyebrow="INFRASTRUCTURE" title="Logical topology" action={<span className="tag neutral">ILLUSTRATIVE</span>}><Topology arrays={arrays} hosts={hosts}/></Panel>
            <Panel eyebrow="CAPACITY BY ARRAY" title="Allocation comparison" action={<select aria-label="Compare arrays" value={comparison} onChange={e => setComparison(e.target.value)}><option value="capacity">Capacity %</option><option value="iops">IOPS</option></select>}>
              <Chart theme={theme} option={compareOption(arrays, comparison, theme)} label="Comparative simulated storage utilization" height={247}/>
            </Panel>
          </div>
          <div className="two-col">
            <Panel eyebrow="PERFORMANCE RANKING" title="Highest I/O workloads" action={<span className="tag neutral">CURRENT SAMPLE</span>}>
              <div className="leader-list">
                {[...arrays].sort((a, b) => b.performance.iops - a.performance.iops).map((array, index) => <div className="leader-row" key={array.id}>
                  <span className="leader-rank">0{index + 1}</span>
                  <div className="leader-main"><div><b>{array.name}</b><strong>{short(array.performance.iops)} IOPS</strong></div>
                    <div className="leader-track"><span style={{ width: pct(array.performance.iops / Math.max(1, ...arrays.map(a => a.performance.iops)) * 100) }}/></div>
                  </div>
                </div>)}
              </div>
            </Panel>
            <Panel eyebrow="ALERT DISTRIBUTION" title="Severity breakdown" action={<span className="tag neutral">SIMULATED</span>}>
              {alerts.length ? <Chart theme={theme} option={severityOption(alerts, theme)} label="Current warning and critical alert distribution" height={250}/> : <div className="empty-state"><Glyph name="shield" size={30}/><b>All clear in this sample</b><p>No synthetic threshold violations are active.</p></div>}
            </Panel>
          </div>
        </>}

        {section === 'Storage arrays' && <>
          <div className="toolbar"><label className="search-box"><Glyph name="search" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search arrays or workloads" aria-label="Search arrays"/></label><CSVButton rows={arrays.map(a => ({ name:a.name, workload:a.workload, capacity_percent:a.capacity.utilization_pct, iops:a.performance.iops, latency_ms:a.performance.latency_ms, throughput_mbps:a.performance.throughput_mbps }))} filename="storageops-array-snapshot.csv"/></div>
          <div className="inventory-grid">{filteredArrays.map(a => <button key={a.id} className="inventory-card" onClick={() => { setSelectedArray(a.id); setDrawer(true); }}><div className="inventory-head"><span className="device-glyph"><Glyph name="server"/></span><span className="tag neutral">SIMULATION</span></div><h2>{a.name}</h2><p>{a.workload}</p><div className="inventory-meter"><span style={{ width: pct(a.capacity.utilization_pct) }}/></div><div className="inventory-stats"><span><small>Used</small><b>{pct(a.capacity.utilization_pct)}</b></span><span><small>IOPS</small><b>{short(a.performance.iops)}</b></span><span><small>Latency</small><b>{a.performance.latency_ms} ms</b></span></div><span className="card-link">Inspect array <Glyph name="arrow" size={15}/></span></button>)}</div>
          <div className="two-col"><Panel eyebrow="COMPARISON" title="Fleet performance"><Chart theme={theme} option={compareOption(arrays, 'iops', theme)} height={275}/></Panel><Panel eyebrow="HISTORICAL LOAD" title="Capacity intensity"><Chart theme={theme} option={heatmapOption(arrays, history, theme)} label="Capacity heatmap of simulated arrays" height={275}/><p className="panel-note">Columns represent chronological samples, not actual calendar events.</p></Panel></div>
        </>}

        {section === 'Host telemetry' && <>
          <div className="host-lead"><div className="real-symbol"><Glyph name="cpu" size={27}/></div><div><h2>Consent-based host readings</h2><p>These CPU, memory, disk and network measurements come from an agent running on an explicitly enrolled computer. They are not storage array metrics.</p></div><span className="tag real">REAL DATA</span></div>
          {!hosts.length ? <div className="onboarding"><div className="onboarding-mark"><Glyph name="cpu" size={40}/></div><h2>No host telemetry received yet</h2><p>Install the opt-in collector on your Windows computer and send one authorized sample. Your real CPU, RAM and disk usage will appear here after submission.</p><ol><li>Configure a unique host token in the repository root .env and restart the API.</li><li>Run the agent with native Windows Python, not Ubuntu WSL.</li><li>Run <code>python host_agent.py --once</code> and refresh this page.</li></ol><a href="https://github.com/kgeckin/storageops-lab/tree/main/agent" target="_blank" rel="noreferrer" className="btn btn-accent">Host agent instructions <Glyph name="arrow" size={17}/></a></div> : <>
            <div className="toolbar"><label><span className="label-text">HOST DEVICE</span><select value={selectedHost} onChange={e => setSelectedHost(e.target.value)}>{hosts.map(h => <option key={h.host_id} value={h.host_id}>{h.host_id}</option>)}</select></label><CSVButton rows={hostRows} filename="storageops-host-readings.csv" title="Export measurements"/></div>
            {selectedHostData && <>
              <div className="host-headline"><div><h2>{selectedHostData.host_id}</h2><span>{selectedHostData.os_family} · {selectedHostData.cpu_count} logical cores · last seen {timestamp(selectedHostData.received_at)}</span></div><span className={'tag ' + (selectedHostData.status === 'online' ? 'real' : 'warning')}>{selectedHostData.status.toUpperCase()}</span></div>
              <div className="host-kpis">
                <div className="host-stat"><span>CPU</span><strong>{pct(selectedHostData.cpu_percent)}</strong><div className="host-meter"><i style={{ width: pct(selectedHostData.cpu_percent) }}/></div></div>
                <div className="host-stat"><span>Memory</span><strong>{pct(selectedHostData.memory.percent)}</strong><small>{gb(selectedHostData.memory.used_bytes)} / {gb(selectedHostData.memory.total_bytes)}</small><div className="host-meter"><i style={{ width: pct(selectedHostData.memory.percent) }}/></div></div>
                <div className="host-stat"><span>System disk</span><strong>{pct(selectedHostData.disk.percent)}</strong><small>{gb(selectedHostData.disk.used_bytes)} / {gb(selectedHostData.disk.total_bytes)}</small><div className="host-meter"><i style={{ width: pct(selectedHostData.disk.percent) }}/></div></div>
                <div className="host-stat"><span>Network counters</span><strong>{short((selectedHostData.network.received_bytes + selectedHostData.network.sent_bytes)/1e9)} GB</strong><small>Lifetime received + sent, not transfer rate</small></div>
              </div>
              <div className="two-col"><Panel eyebrow="REAL CPU TELEMETRY" title="CPU utilization"><Chart theme={theme} option={hostLine('cpu', 'CPU', theme === 'dark' ? palette.cyan : '#146EAC')} label="Real CPU readings from enrolled host" height={270}/></Panel><Panel eyebrow="REAL MEMORY TELEMETRY" title="Memory utilization"><Chart theme={theme} option={hostLine('memory', 'Memory', theme === 'dark' ? palette.teal : '#007B6E')} label="Real memory readings from enrolled host" height={270}/></Panel></div>
              <Panel eyebrow="AUTHENTICITY" title="How to verify your device"><div className="verification"><span className="verification-badge"><Glyph name="shield"/> AGENT RECEIPT</span><div><b>Host: {selectedHostData.host_id}</b><p>OS: {selectedHostData.os_family}. Received by API at {selectedHostData.received_at}. Captured using local psutil and token-validated HTTP ingestion.</p></div><p className="disclaimer">The dashboard displays measurements reported by the agent. It cannot independently attest hardware identity or prove the host has not been tampered with.</p></div></Panel>
            </>}
          </>}
        </>}

        {section === 'Performance' && <>
          <div className="toolbar"><label><span className="label-text">ARRAY</span><select value={selectedArray} onChange={e => setSelectedArray(e.target.value)}>{arrays.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label><CSVButton rows={metricRows} filename="storageops-performance.csv"/></div>
          <div className="two-col"><Panel eyebrow="I/O RATE" title="IOPS history"><Chart theme={theme} option={areaOption(selectedSamples, 'iops', theme)} height={280}/></Panel><Panel eyebrow="RESPONSE TIME" title="Latency history"><Chart theme={theme} option={areaOption(selectedSamples, 'latency_ms', theme)} height={280}/></Panel><Panel eyebrow="DATA FLOW" title="Throughput history"><Chart theme={theme} option={areaOption(selectedSamples, 'throughput_mbps', theme)} height={280}/></Panel><Panel eyebrow="CAPACITY UTILIZATION" title="Capacity history"><Chart theme={theme} option={areaOption(selectedSamples, 'capacity', theme)} height={280}/></Panel></div>
          <Panel eyebrow="OPERATIONS HEATMAP" title="Load distribution by sample"><Chart theme={theme} option={heatmapOption(arrays, history, theme)} height={330}/></Panel>
        </>}

        {section === 'Incidents' && <>
          <div className="incident-summary"><div><span>Current alerts</span><b>{alerts.length}</b></div><div><span>Threshold crossings in samples</span><b>{allEvents.length}</b></div><div><span>Capacity policy</span><b>80%</b></div><div><span>Latency policy</span><b>5 ms</b></div></div>
          <Panel eyebrow="POLICY ENGINE" title="Threshold observations"><p className="panel-note">Derived from synthetic metric history. These are threshold crossings, not stored or acknowledged incident tickets.</p>
            <div className="incident-list">{allEvents.length ? allEvents.map(e => <div className="incident-row" key={e.id}><span className={'severity-marker ' + e.severity}><Glyph name="bell" size={16}/></span><div><b>{e.type}</b><p>{e.host} · {e.detail}</p></div><span className="incident-time">{timestamp(e.time)}</span><span className={'tag ' + e.severity}>{e.severity}</span></div>) : <div className="empty-state">No threshold crossings in the selected history window.</div>}</div>
          </Panel>
        </>}
        <footer className="footer"><span>STORAGEOPS LAB · v0.2 · Synthetic arrays, opt-in host telemetry</span><span>Built to learn infrastructure observability · <a href={API + '/docs'} target="_blank" rel="noreferrer">API reference ↗</a></span></footer>
      </div>
    </main>
    {drawer && current && <div className="drawer-shade" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(false); }}><aside className="drawer" role="dialog" aria-modal="true" aria-label={current.name + ' details'}><div className="drawer-top"><span className="eyebrow">STORAGE ARRAY PROFILE</span><button className="icon-button" onClick={() => setDrawer(false)} aria-label="Close array details"><Glyph name="close"/></button></div><div className="drawer-visual"><Glyph name="server" size={47}/></div><h2>{current.name}</h2><p>{current.workload}</p><div className="drawer-stat"><span>Capacity used</span><b>{pct(current.capacity.utilization_pct)}</b></div><div className="drawer-stat"><span>Total capacity</span><b>{short(current.capacity.total_tb)} TB</b></div><div className="drawer-stat"><span>IOPS</span><b>{short(current.performance.iops)}</b></div><div className="drawer-stat"><span>Latency</span><b>{current.performance.latency_ms} ms</b></div><div className="drawer-stat"><span>Throughput</span><b>{short(current.performance.throughput_mbps)} Mbps</b></div><div className="tag neutral">SIMULATED ARRAY</div><button className="btn btn-accent drawer-action" onClick={() => { setSection('Performance'); setDrawer(false); }}>Explore trends <Glyph name="arrow" size={17}/></button></aside></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
