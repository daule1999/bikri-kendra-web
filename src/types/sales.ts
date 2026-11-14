export interface Order {
  id: string
  customerId: string
  amount: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: Date
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
}