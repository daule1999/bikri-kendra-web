interface CardProps {
  children: React.ReactNode
  title?: string
}

export default function Card({ children, title }: CardProps) {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      {title && <h3 className="font-bold mb-2">{title}</h3>}
      {children}
    </div>
  )
}