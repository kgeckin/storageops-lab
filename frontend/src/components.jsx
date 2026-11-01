import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { palette, short, pct } from './charts.js';

export function Glyph({ name, size = 20 }) {
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

export function Chart({ option, theme, height = 260, label = 'Data visualization' }) {
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

export function Sparkline({ points = [], field = 'iops', color = palette.cyan }) {
  const nums = points.slice(-16).map(p => field === 'iops' ? p.performance.iops : p.performance.latency_ms);
  if (nums.length < 2) return <span className="spark-placeholder">● ● ●</span>;
  const min = Math.min(...nums), max = Math.max(...nums), range = Math.max(1, max - min);
  const d = nums.map((v, i) => (i ? 'L' : 'M') + (i * 100 / (nums.length - 1)).toFixed(1) + ',' + (34 - (v-min)/range*25).toFixed(1)).join(' ');
  return <svg viewBox="0 0 100 42" aria-hidden="true" className="spark"><path d={d} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round"/></svg>;
}

export function Panel({ eyebrow, title, action, children, className = '' }) {
  return <section className={'panel ' + className}>
    <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>
    {children}
  </section>;
}

export function Topology({ arrays, hosts }) {
  return <div className="topology">
    <div className="topo-node topo-hub"><Glyph name="layers" size={26}/><strong>Observability API</strong><small>Local lab · FastAPI</small></div>
    <div className="topo-connect" aria-hidden="true"><span/><span/><span/></div>
    <div className="topo-endpoints">
      {arrays.map(a => <div className="topo-node" key={a.id}><Glyph name="server"/><strong>{a.name}</strong><small>Simulated</small></div>)}
      <div className="topo-node actual"><Glyph name="cpu"/><strong>{hosts.length ? hosts.length + ' host(s)' : 'Host collector'}</strong><small>{hosts.length ? 'Opt-in · live' : 'Awaiting enrollment'}</small></div>
    </div>
  </div>;
}

export function CSVButton({ title, rows, filename }) {
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

