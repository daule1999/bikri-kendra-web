export interface Invoice {
  id: string
  customerId: string
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  dueDate: Date
  createdAt: Date
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: 'cash' | 'card' | 'upi' | 'bank'
  paidAt: Date
}