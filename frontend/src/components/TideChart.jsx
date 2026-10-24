import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const localHour = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  return Number(parts.find((part) => part.type === 'hour')?.value || 0) + Number(parts.find((part) => part.type === 'minute')?.value || 0) / 60
}
const labelHour = (hour) => `${Math.floor(hour) % 12 || 12}${hour >= 12 ? 'p' : 'a'}`

export default function TideChart({ tide = [], windows = [] }) {
  const data = tide.map((point) => ({ hour: localHour(point.t), tide: point.ft }))
  if (!data.length) return <section className="panel"><p className="eyebrow">TIDE CHECK</p><h2>Tide details unavailable</h2><p className="muted">Missing tide data is not a reason to assume conditions are safe.</p></section>
  return <section className="panel tide-panel">
    <div className="section-heading"><div><p className="eyebrow">WATER MOVEMENT</p><h2>Today's tide</h2></div><span className="chart-unit">feet</span></div>
    <p className="muted chart-subtitle">Moving water can help fish find food. Highlighted times are suggested windows.</p>
    <div className="tide-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 6, left: -22, bottom: 0 }}>
      <defs><linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65cdbb" stopOpacity={0.38} /><stop offset="100%" stopColor="#65cdbb" stopOpacity={0.02} /></linearGradient></defs>
      <CartesianGrid stroke="#193d3a" strokeOpacity={0.1} vertical={false} />
      {windows.map((window, index) => <ReferenceArea key={`${window.spotId}-${index}`} x1={Number(window.start.slice(0, 2)) + Number(window.start.slice(3)) / 60} x2={Number(window.end.slice(0, 2)) + Number(window.end.slice(3)) / 60} fill="#f4aa55" fillOpacity={0.18} />)}
      <XAxis dataKey="hour" type="number" domain={['dataMin', 'dataMax']} tickFormatter={labelHour} tickLine={false} axisLine={false} tick={{ fill: '#6c7d78', fontSize: 11 }} minTickGap={22} />
      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6c7d78', fontSize: 10 }} />
      <Tooltip labelFormatter={(hour) => `${labelHour(Number(hour))} local time`} formatter={(value) => [`${Number(value).toFixed(2)} ft`, 'Tide']} contentStyle={{ borderRadius: 14, border: '1px solid #e1e9e3', fontSize: 12 }} />
      <Area type="monotone" dataKey="tide" stroke="#208f81" strokeWidth={3} fill="url(#tideFill)" activeDot={{ r: 5, fill: '#f4aa55', stroke: '#fff', strokeWidth: 2 }} />
    </AreaChart></ResponsiveContainer></div>
    <div className="chart-legend"><span><i className="legend-tide" /> Tide level</span><span><i className="legend-window" /> Suggested window</span></div>
    <p className="source-note">NOAA CO-OPS · Updated {new Date(tide[0].t).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })}. Times shown in Central Time.</p>
  </section>
}
