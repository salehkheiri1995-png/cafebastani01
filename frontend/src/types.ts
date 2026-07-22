// تایپ‌های مشترک — هم‌راستا با اسکیماهای Pydantic بک‌اند

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  display_order: number;
}

export interface MenuCategory {
  id: number;
  name: string;
  display_order: number;
  products: Product[];
}

export interface Category {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
}

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface OrderItem {
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  source: "online" | "walk_in";
  customer_name: string | null;
  note: string | null;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
  qr_image: string | null;
}
