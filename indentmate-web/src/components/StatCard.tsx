import { Card, Statistic } from 'antd'

type StatCardProps = {
  title: string
  value: number | string
  suffix?: string
}

export default function StatCard({ title, value, suffix }: StatCardProps) {
  return (
    <Card>
      <Statistic title={title} value={value} suffix={suffix} />
    </Card>
  )
}
