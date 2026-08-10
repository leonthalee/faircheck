export interface ReceiptItem {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  taxRate: number | null;
  priceBeforeTax: number | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  unitPriceBeforeTax: number | null;
  tags: string[];
}

export interface Receipt {
  id: string;
  /** User-assigned display name, independent of `store` — lets you tell apart
   * e.g. two same-day receipts from the same shop. Not sourced from the CSV. */
  label: string | null;
  date: Date;
  store: string;
  address: string | null;
  description: string | null;
  amount: number;
  amountBeforeTax: number | null;
  paymentMethod: string | null;
  category: string | null;
  currency: string;
  transactionNumber: string | null;
  receiptNumber: string | null;
  notes: string | null;
  items: ReceiptItem[];
}
