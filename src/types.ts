export type UserRole = 'admin' | 'company_user';

export interface Company {
  id: string;
  name: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  role: UserRole;
  companyId: string;
  mustChangePassword?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  companyId: string;
}

export interface Distributor {
  id: string;
  name: string;
  companyId: string;
}

export interface Shipment {
  id: string;
  trackingCode: string;
  quantity: number;
  distributorId: string;
  customerId: string;
  companyId: string;
  status: 'in-stock' | 'withdrawn';
  createdAt: string;
  withdrawnAt?: string;
  receiverName?: string;
  receiverCpf?: string;
}
