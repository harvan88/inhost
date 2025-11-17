interface StatusCardProps {
  title: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}

const colorClasses = {
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function StatusCard({ title, value, color }: StatusCardProps) {
  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide opacity-75 mb-2">
        {title}
      </h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
