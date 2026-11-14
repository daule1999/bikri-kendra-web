export default function PaymentSummary() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-accent p-4 rounded">
        <h3 className="font-bold">Total Revenue</h3>
        <p className="text-2xl">₹2,45,000</p>
      </div>
      <div className="bg-accent p-4 rounded">
        <h3 className="font-bold">Pending</h3>
        <p className="text-2xl">₹15,000</p>
      </div>
      <div className="bg-accent p-4 rounded">
        <h3 className="font-bold">Overdue</h3>
        <p className="text-2xl">₹5,000</p>
      </div>
    </div>
  )
}