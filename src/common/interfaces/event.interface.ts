export interface ProductInfo {
  id: string;
  category: string;
  price: number;
}

export interface SaleEvent {
  transaction_id: string;
  customer_id: string;
  timestamp: string;
  product: ProductInfo;
  quantity: number;
}

export interface BronzeRecord extends SaleEvent {
  ingested_at: Date;
}

export interface SilverRecord {
  transaction_id: string;
  customer_id: string;
  timestamp: string;
  product: ProductInfo;
  quantity: number;
  total_amount: number;
  ingested_at: Date;
}

export interface GoldRecord {
  category: string;
  sale_date: string;
  total_sales: number;
  transaction_count: number;
}

export interface ErrorRecord {
  original: BronzeRecord;
  reason: string;
  failed_at: Date;
}
