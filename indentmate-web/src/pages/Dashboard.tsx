import { Card, Typography } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import StatCard from '../components/StatCard'

const statusData = [
  { name: 'Created', count: 18 },
  { name: 'Pending', count: 9 },
  { name: 'Approved', count: 31 },
  { name: 'Rejected', count: 3 },
]

export default function Dashboard() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Dashboard
          </Typography.Title>
          <Typography.Text type="secondary">Indent activity overview</Typography.Text>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Indents" value={61} />
        <StatCard title="Pending Approval" value={9} />
        <StatCard title="Approved" value={31} />
        <StatCard title="Sync Rate" value={96} suffix="%" />
      </div>

      <Card title="Indent Status">
        <ResponsiveContainer height={280} width="100%">
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#1565d8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </section>
  )
}
