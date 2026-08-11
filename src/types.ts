export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'order_fulfillment'
  | 'shipping'
  | 'customer_care'
  | 'promotions'
  | 'customer';

export type ShowcaseType = 'ready_stock' | 'delivered_craft';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  favorites: string[];
  createdAt: any;
}

export interface StaffAccount {
  uid: string;
  email: string;
  role: UserRole;
  favorites: string[];
  createdAt?: any;
  disabled?: boolean;
  lastSignInTime?: string | null;
  creationTime?: string | null;
}

export interface StaffAccountInput {
  email: string;
  password: string;
  role: Exclude<UserRole, 'customer' | 'super_admin'>;
}

export interface StaffAccountActionResult {
  message: string;
  resetPassword?: { newPassword: string };
}

export interface FashionItem {
  id: string;
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  category: string;
  fabricImageUrl: string;
  renderedImageUrl?: string;
  stock: number;
  isOneOfOne: boolean;
  salePrice?: number;
  saleDescription?: string;
  styles: string[];
  showcaseType: ShowcaseType;
  barcodeString?: string;
  barcodeUrl?: string;
  sku?: string;
  gstRate?: GSTRate;
  isPublished?: boolean;
  sourceOrderId?: string;
  createdAt: any;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startDate: any;
  endDate: any;
  isActive: boolean;
  applicableCategories: string[];
  bannerUrl?: string;
  createdAt: any;
}

export interface OrderItem {
  itemId: string;
  quantity: number;
  type: 'stitched' | 'material';
  measurements?: Record<string, string>;
  unitPrice?: number;
  unitCost?: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  razorpayOrderId?: string;
  trackingNumber?: string;
  createdAt: any;
}

export interface Measurements {
  neck?: string;
  bust?: string;
  waist?: string;
  hips?: string;
  length?: string;
  sleeveLength?: string;
}

export type GSTRate = 0 | 3 | 5 | 12 | 18 | 28;
export type GSTTaxMode = 'intra_state' | 'inter_state';
export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface AccountsSettings {
  legalName: string;
  tradeName: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  financialYearLabel: string;
  defaultGstRate: GSTRate;
  defaultTaxMode: GSTTaxMode;
  createdAt?: any;
  updatedAt?: any;
}

export interface AccountingEntry {
  id: string;
  sourceOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail?: string;
  customerGstin?: string;
  placeOfSupply: string;
  itemSummary: string;
  taxableAmount: number;
  gstRate: GSTRate;
  taxMode: GSTTaxMode;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  costAmount?: number;
  marginAmount?: number;
  profitAmount?: number;
  paymentStatus: InvoicePaymentStatus;
  paymentMethod: string;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface SystemSettings {
  enableBarcodeInventory: boolean;
  enableModelShotAi: boolean;
  defaultGstRate: GSTRate;
  createdAt?: any;
  updatedAt?: any;
}

export interface Review {
  id: string;
  itemId: string;
  orderId: string;
  userId: string;
  rating: number;
  reviewText: string;
  clientPhotoUrl?: string;
  isVerified: boolean;
  isPublished: boolean;
  createdAt: any;
  updatedAt?: any;
}
