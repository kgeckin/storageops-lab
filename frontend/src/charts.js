import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, VisualMapComponent, AriaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, VisualMapComponent, AriaComponent, CanvasRenderer]);

export const palette = {
  gold: '#E5C78F', cyan: '#64B8FF', teal: '#54D3BD',
  violet: '#B9A3FC', amber: '#F3BB66', red: '#FA8787',
};
const isNumber = value => Number.isFinite(Number(value));
export const short = value => isNumber(value) ? format.format(value) : '—';
export const pct = value => isNumber(value) ? short(value) + '%' : '—';
export const gb = value => short(value / 1_000_000_000) + ' GB';
export const timestamp = value => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';


function baseAxes(colors) {
  return {
    axisLabel: { color: colors.secondary, fontSize: 11 },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
  };
}

export function areaOption(points, measure, theme) {
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

export function capacityOption(used, total, theme) {
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

export function compareOption(arrays, metric, theme) {
  const c = useColorsDummy(theme);
  const values = arrays.map(a => metric === 'iops' ? a.performance.iops : a.capacity.utilization_pct);
  return {
    backgroundColor: 'transparent', grid: { left: 84, right: 28, top: 17, bottom: 30 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => short(v) },
    xAxis: { type: 'value', ...baseAxes(c) }, yAxis: { type: 'category', data: arrays.map(a => a.name), ...baseAxes(c), splitLine: { show: false } },
    series: [{ type: 'bar', barMaxWidth: 24, data: values.map((v, i) => ({ value: v, itemStyle: { color: (theme === 'dark' ? [palette.cyan, palette.gold, palette.teal] : ['#146EAC','#76551D','#007B6E'])[i % 3], borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: 'right', color: c.secondary, formatter: x => metric === 'iops' ? short(x.value) : pct(x.value) } }]
  };
}
function useColorsDummy(theme) {
  return theme === 'dark' ? { secondary: '#ABC0CE', line: '#344552' } : { secondary: '#54687B', line: '#D6E0E8' };
}

export function heatmapOption(arrays, histories, theme) {
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


export function severityOption(alerts, theme) {
  const warning = alerts.filter(a => a.severity === 'warning').length;
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const colors = theme === 'dark' ? [palette.amber, palette.red] : ['#965A00', '#AF3440'];
  return {
    tooltip: { trigger: 'item', formatter: p => p.name + ': ' + p.value },
    legend: { bottom: 0, textStyle: { color: useColorsDummy(theme).secondary } },
    series: [{ type: 'pie', radius: ['55%', '77%'], center: ['50%', '46%'],
      label: { show: true, formatter: '{b}: {c}', color: useColorsDummy(theme).secondary },
      labelLine: { length: 9 }, itemStyle: { borderRadius: 5 },
      data: [
        { name: 'Warning', value: warning, itemStyle: { color: colors[0] } },
        { name: 'Critical', value: critical, itemStyle: { color: colors[1] } }
      ] }]
  };
}

