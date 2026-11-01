import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, VisualMapComponent, AriaComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import './styles.css';

echarts.use([
  LineChart, BarChart, PieChart, HeatmapChart, GridComponent, TooltipComponent,
  LegendComponent, TitleComponent, DataZoomComponent, VisualMapComponent, AriaComponent,
  CanvasRenderer
]);

const API = import.meta.env.VITE_STORAGEOPS_API || '';
const SECTIONS = ['Overview', 'Storage arrays', 'Host telemetry', 'Performance', 'Incidents'];
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const palette = {
  gold: '#E5C78F', cyan: '#64B8FF', teal: '#54D3BD',
  violet: '#B9A3FC', amber: '#F3BB66', red: '#FA8787',
};
const isNumber = value => Number.isFinite(Number(value));
const short = value => isNumber(value) ? format.format(value) : '—';
const pct = value => isNumber(value) ? short(value) + '%' : '—';
const gb = value => short(value / 1_000_000_000) + ' GB';
const timestamp = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

async function getJSON(path, signal) {
  const response = await fetch(API + path, { signal });
  if (!response.ok) throw Error('HTTP ' + response.status + ': ' + path);
  return response.json();
}

function Glyph({ name, size = 20 }) {
  const shapes = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    server: <><rect x="3" y="4" width="18" height="6" rx="1.7"/><rect x="3" y="14" width="18" height="6" rx="1.7"/><circle cx="7" cy="7" r=".8"/><circle cx="7" cy="17" r=".8"/></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="10" y="10" width="4" height="4" rx=".5"/></>,
    wave: <path d="M2 12h4l3-7 5 14 3-7h5"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10 21h4"/></>,
    chart: <><path d="M4 3v18h17"/><path d="m8 15 4-5 4 3 5-8"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-5L3 9"/><path d="M3 3v6h6"/><path d="M4 13a8 8 0 0 0 14 5l3-3"/><path d="M21 21v-6h-6"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
    moon: <path d="M20 15.6A8 8 0 0 1 8.4 4 8.1 8.1 0 1 0 20 15.6Z"/>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 17v4h16v-4"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    pause: <><path d="M8 4v16M16 4v16"/></>,
    play: <path d="m8 5 11 7-11 7V5Z"/>,
    shield: <><path d="M12 22S4 18 4 10V5l8-3 8 3v5c0 8-8 12-8 12Z"/><path d="m9 12 2 2 4-4"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] || shapes.grid}</svg>;
}

function Chart({ option, theme, height = 260, label = 'Data visualization' }) {
  const node = useRef(null);
  useEffect(() => {
    if (!node.current) return undefined;
    const plot = echarts.init(node.current, undefined, { renderer: 'canvas' });
    plot.setOption({ ...option, aria: { enabled: true }, animationDuration: 700 });
    const resize = new ResizeObserver(() => plot.resize());
    resize.observe(node.current);
    return () => { resize.disconnect(); plot.dispose(); };
  }, [option, theme]);
  return <div ref={node} role="img" aria-label={label} className="chart" style={{ height }} />;
}

function useColors(theme) {
  return useMemo(() => ({
    text: theme === 'dark' ? '#D8E3ED' : '#273A4A',
    secondary: theme === 'dark' ? '#ABC0CE' : '#54687B',
    line: theme === 'dark' ? '#344552' : '#D6E0E8',
    tooltip: theme === 'dark' ? '#202C38' : '#FFFFFF',
    colors: [palette.cyan, palette.teal, palette.violet, palette.gold, palette.amber],
  }), [theme]);
}

function baseAxes(colors) {
  return {
    axisLabel: { color: colors.secondary, fontSize: 11 },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
  };
}

function areaOption(points, measure, theme) {
  const c = theme === 'dark' ? '#64B8FF' : '#1670AC';
  const colors = theme === 'dark' ? { secondary: '#ABC0CE', line: '#344552', tooltip: '#202C38' } : { secondary: '#54687B', line: '#D6E0E8', tooltip: '#FFFFFF' };
  const values = points.map(s => measure === 'capacity' ? s.capacity.utilization_pct : s.performance[measure]);
  const label = ({ iops: 'IOPS', latency_ms: 'Latency (ms)', throughput_mbps: 'Throughput (Mbps)', capacity: 'Capacity (%)' })[measure];
  return {
    backgroundColor: 'transparent',
    grid: { left: 55, right: 20, top: 25, bottom: 42 },
    tooltip: { trigger: 'axis', backgroundColor: colors.tooltip, borderColor: colors.line,
      textStyle: { color: theme === 'dark' ? '#F4F7FC' : '#172532' },
      valueFormatter: v => short(v) },
    xAxis: { type: 'category', boundaryGap: false, data: points.map(p => timestamp(p.at)),
      ...baseAxes(colors), splitLine: { show: false }, axisLabel: { color: colors.secondary, hideOverlap: true } },
    yAxis: { type: 'value', min: v => Math.max(0, Math.floor(v.min * 0.9)), ...baseAxes(colors) },
    series: [{ name: label, type: 'line', data: values, smooth: true, symbol: 'none',
      lineStyle: { width: 3.1, color: c }, areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: theme === 'dark' ? 'rgba(100,184,255,.36)' : 'rgba(22,112,172,.24)' },
          { offset: 1, color: 'rgba(100,184,255,0)' },
        ])
      }, emphasis: { focus: 'series' } }],
  };
}

function capacityOption(used, total, theme) {
  const n = Math.max(0, total - used);
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: x => x.name + ': ' + short(x.value) + ' TB' },
    series: [{ type: 'pie', radius: ['68%', '87%'], center: ['50%', '50%'], avoidLabelOverlap: false,
      silent: false, padAngle: 3, itemStyle: { borderRadius: 7 },
      label: { show: false }, emphasis: { scaleSize: 5 },
      data: [{ name: 'Used', value: used, itemStyle: { color: theme === 'dark' ? palette.gold : '#8A651E' } },
        { name: 'Available', value: n, itemStyle: { color: theme === 'dark' ? '#2A3A48' : '#E6EDF4' } }] }],
  };
}

function compareOption(arrays, metric, theme) {
  const c = useColorsDummy(theme);
  const values = arrays.map(a => metric === 'iops' ? a.performance.iops : a.capacity.utilization_pct);
  return {
    backgroundColor: 'transparent', grid: { left: 84, right: 28, top: 17, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => short(v) },
    xAxis: { type: 'value', ...baseAxes(c) }, yAxis: { type: 'category', data: arrays.map(a => a.name), ...baseAxes(c), splitLine: { show: false } },
    series: [{ type: 'bar', barMaxWidth: 24, data: values.map((v, i) => ({ value: v, itemStyle: { color: [palette.cyan, palette.gold, palette.teal][i % 3], borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: 'right', color: c.secondary, formatter: x => metric === 'iops' ? short(x.value) : pct(x.value) } }]
  };
}
function useColorsDummy(theme) {
  return theme === 'dark' ? { secondary: '#ABC0CE', line: '#344552' } : { secondary: '#54687B', line: '#D6E0E8' };
}

function heatmapOption(arrays, histories, theme) {
  const c = useColorsDummy(theme);
  const count = Math.max(...arrays.map(a => (histories[a.id] || []).length), 0);
  const categories = Array.from({ length: count }, (_, i) => String(i + 1));
  const cells = arrays.flatMap((array, y) => (histories[array.id] || []).map((p, x) => [x, y, p.capacity.utilization_pct]));
  return {
    tooltip: { formatter: p => arrays[p.value[1]]?.name + ': ' + pct(p.value[2]) },
    grid: { top: 20, left: 85, right: 24, bottom: 48 },
    xAxis: { type: 'category', data: categories, ...baseAxes(c), splitLine: { show: false }, axisLabel: { interval: Math.max(0, Math.floor(count / 8) - 1) } },
    yAxis: { type: 'category', data: arrays.map(a => a.name), ...baseAxes(c), splitLine: { show: false } },
    visualMap: { show: false, min: 0, max: 100, inRange: { color: theme === 'dark' ? ['#1E4053', '#3A8E9D', '#E5C78F'] : ['#D9EAF2', '#54A9B1', '#8A651E'] } },
    series: [{ type: 'heatmap', data: cells, itemStyle: { borderWidth: 3, borderColor: theme === 'dark' ? '#17222D' : '#F9FBFD', borderRadius: 4 } }],
  };
}

function Sparkline({ points = [], field = 'iops', color = palette.cyan }) {
  const nums = points.slice(-16).map(p => field === 'iops' ? p.performance.iops : p.performance.latency_ms);
  if (nums.length < 2) return <span className="spark-placeholder">● ● ●</span>;
  const min = Math.min(...nums), max = Math.max(...nums), range = Math.max(1, max - min);
  const d = nums.map((v, i) => (i ? 'L' : 'M') + (i * 100 / (nums.length - 1)).toFixed(1) + ',' + (34 - (v-min)/range*25).toFixed(1)).join(' ');
  return <svg viewBox="0 0 100 42" aria-hidden="true" className="spark"><path d={d} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round"/></svg>;
}

function Panel({ eyebrow, title, action, children, className = '' }) {
  return <section className={'panel ' + className}>
    <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>
    {children}
  </section>;
}

function Topology({ arrays, hosts }) {
  return <div className="topology">
    <div className="topo-node topo-hub"><Glyph name="layers" size={26}/><strong>Observability API</strong><small>Local lab · FastAPI</small></div>
    <div className="topo-connect" aria-hidden="true"><span/><span/><span/></div>
    <div className="topo-endpoints">
      {arrays.map(a => <div className="topo-node" key={a.id}><Glyph name="server"/><strong>{a.name}</strong><small>Simulated</small></div>)}
      <div className="topo-node actual"><Glyph name="cpu"/><strong>{hosts.length ? hosts.length + ' host(s)' : 'Host collector'}</strong><small>{hosts.length ? 'Opt-in · live' : 'Awaiting enrollment'}</small></div>
    </div>
  </div>;
}

function CSVButton({ title, rows, filename }) {
  function download() {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const quote = value => '"' + String(value ?? '').replaceAll('"', '""').replace(/^[=+@-]/, "'$&") + '"';
    const csv = [columns.map(quote).join(','), ...rows.map(row => columns.map(k => quote(row[k])).join(','))].join('\r\n');
    const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button className="btn btn-minor" type="button" disabled={!rows.length} onClick={download}><Glyph name="download" size={16}/>{title || 'Export CSV'}</button>;
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
      series: [{ type: 'line', name: title, data: hostHistory.map(p => field === 'cpu' ? p.cpu_percent : p[field].percent), smooth: true, showSymbol: false,
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
              <div className="two-col"><Panel eyebrow="REAL CPU TELEMETRY" title="CPU utilization"><Chart theme={theme} option={hostLine('cpu', 'CPU', palette.cyan)} label="Real CPU readings from enrolled host" height={270}/></Panel><Panel eyebrow="REAL MEMORY TELEMETRY" title="Memory utilization"><Chart theme={theme} option={hostLine('memory', 'Memory', palette.teal)} label="Real memory readings from enrolled host" height={270}/></Panel></div>
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
