import {
  AccountingEntry,
  AccountsSettings,
  FashionItem,
  Order,
  OrderStatus,
  Promotion,
  UserProfile,
  UserRole,
} from '../types';
import { supabase } from '../lib/supabase';

function throwSb(error: { message?: string } | null, context: string): never {
  throw new Error(error?.message || context);
}

function mapItem(row: any): FashionItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    category: row.category,
    fabricImageUrl: row.fabric_image_url,
    renderedImageUrl: row.rendered_image_url || undefined,
    stock: Number(row.stock ?? 0),
    isOneOfOne: Boolean(row.is_one_of_one),
    salePrice: row.sale_price != null ? Number(row.sale_price) : undefined,
    saleDescription: row.sale_description || undefined,
    styles: row.styles || [],
    createdAt: row.created_at,
  };
}

function itemToRow(item: Partial<FashionItem>) {
  const row: Record<string, unknown> = {};
  if (item.name !== undefined) row.name = item.name;
  if (item.description !== undefined) row.description = item.description;
  if (item.price !== undefined) row.price = item.price;
  if (item.category !== undefined) row.category = item.category;
  if (item.fabricImageUrl !== undefined) row.fabric_image_url = item.fabricImageUrl;
  if (item.renderedImageUrl !== undefined) row.rendered_image_url = item.renderedImageUrl;
  if (item.stock !== undefined) row.stock = item.stock;
  if (item.isOneOfOne !== undefined) row.is_one_of_one = item.isOneOfOne;
  if (item.salePrice !== undefined) row.sale_price = item.salePrice;
  if (item.saleDescription !== undefined) row.sale_description = item.saleDescription;
  if (item.styles !== undefined) row.styles = item.styles;
  return row;
}

function mapPromotion(row: any): Promotion {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
    applicableCategories: row.applicable_categories || [],
    bannerUrl: row.banner_url || undefined,
    createdAt: row.created_at,
  };
}

function promotionToRow(promo: Partial<Promotion>) {
  const row: Record<string, unknown> = {};
  if (promo.title !== undefined) row.title = promo.title;
  if (promo.description !== undefined) row.description = promo.description;
  if (promo.discountType !== undefined) row.discount_type = promo.discountType;
  if (promo.discountValue !== undefined) row.discount_value = promo.discountValue;
  if (promo.startDate !== undefined) row.start_date = promo.startDate;
  if (promo.endDate !== undefined) row.end_date = promo.endDate;
  if (promo.isActive !== undefined) row.is_active = promo.isActive;
  if (promo.applicableCategories !== undefined) row.applicable_categories = promo.applicableCategories;
  if (promo.bannerUrl !== undefined) row.banner_url = promo.bannerUrl;
  return row;
}

function mapAccountsSettings(row: any): AccountsSettings {
  return {
    legalName: row.legal_name,
    tradeName: row.trade_name,
    gstin: row.gstin || '',
    stateCode: row.state_code,
    stateName: row.state_name,
    invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: Number(row.next_invoice_number),
    financialYearLabel: row.financial_year_label,
    defaultGstRate: Number(row.default_gst_rate) as AccountsSettings['defaultGstRate'],
    defaultTaxMode: row.default_tax_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntry(row: any): AccountingEntry {
  return {
    id: row.id,
    sourceOrderId: row.source_order_id || undefined,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    customerName: row.customer_name,
    customerEmail: row.customer_email || undefined,
    customerGstin: row.customer_gstin || undefined,
    placeOfSupply: row.place_of_supply,
    itemSummary: row.item_summary,
    taxableAmount: Number(row.taxable_amount),
    gstRate: Number(row.gst_rate) as AccountingEntry['gstRate'],
    taxMode: row.tax_mode,
    cgstAmount: Number(row.cgst_amount),
    sgstAmount: Number(row.sgst_amount),
    igstAmount: Number(row.igst_amount),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || '',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const defaultAccountsSettings: AccountsSettings = {
  legalName: "Sweta's Atelier",
  tradeName: "Sweta's Atelier",
  gstin: '',
  stateCode: '27',
  stateName: 'Maharashtra',
  invoicePrefix: 'SWA',
  nextInvoiceNumber: 1,
  financialYearLabel: '2026-27',
  defaultGstRate: 5,
  defaultTaxMode: 'intra_state',
};

export const ItemService = {
  async getAllItems() {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
    if (error) throwSb(error, 'Unable to list items.');
    return (data || []).map(mapItem);
  },

  async getItemById(id: string) {
    const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
    if (error) throwSb(error, 'Unable to load item.');
    return data ? mapItem(data) : null;
  },

  async addItem(item: Omit<FashionItem, 'id' | 'createdAt'>) {
    const { data, error } = await supabase.from('items').insert(itemToRow(item)).select('id').single();
    if (error) throwSb(error, 'Unable to create item.');
    return data.id as string;
  },

  async updateItem(id: string, updates: Partial<FashionItem>) {
    const { error } = await supabase.from('items').update(itemToRow(updates)).eq('id', id);
    if (error) throwSb(error, 'Unable to update item.');
  },

  async deleteItem(id: string) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throwSb(error, 'Unable to delete item.');
  },
};

export const OrderService = {
  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'status'>) {
    const { data: header, error } = await supabase
      .from('orders')
      .insert({
        user_id: order.userId,
        status: 'pending',
        total_amount: order.totalAmount,
        razorpay_order_id: order.razorpayOrderId || null,
        tracking_number: order.trackingNumber || null,
      })
      .select('id')
      .single();
    if (error) throwSb(error, 'Unable to create order.');

    const lines = (order.items || []).map((line) => ({
      order_id: header.id,
      item_id: line.itemId || null,
      quantity: line.quantity,
      type: line.type,
      measurements: line.measurements || {},
    }));

    if (lines.length) {
      const { error: linesError } = await supabase.from('order_items').insert(lines);
      if (linesError) throwSb(linesError, 'Unable to create order items.');
    }

    return header.id as string;
  },

  async getUserOrders(userId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throwSb(error, 'Unable to list user orders.');

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      totalAmount: Number(row.total_amount),
      status: row.status as OrderStatus,
      razorpayOrderId: row.razorpay_order_id || undefined,
      trackingNumber: row.tracking_number || undefined,
      createdAt: row.created_at,
      items: (row.order_items || []).map((line: any) => ({
        itemId: line.item_id,
        quantity: line.quantity,
        type: line.type,
        measurements: line.measurements || undefined,
      })),
    })) as Order[];
  },

  async getAllOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throwSb(error, 'Unable to list orders.');

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      totalAmount: Number(row.total_amount),
      status: row.status as OrderStatus,
      razorpayOrderId: row.razorpay_order_id || undefined,
      trackingNumber: row.tracking_number || undefined,
      createdAt: row.created_at,
      items: (row.order_items || []).map((line: any) => ({
        itemId: line.item_id,
        quantity: line.quantity,
        type: line.type,
        measurements: line.measurements || undefined,
      })),
    })) as Order[];
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, trackingNumber?: string) {
    const updates: Record<string, unknown> = { status };
    if (trackingNumber) updates.tracking_number = trackingNumber;
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) throwSb(error, 'Unable to update order.');
  },
};

export const UserService = {
  async getProfile(uid: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', uid)
      .maybeSingle();
    if (error) throwSb(error, 'Unable to load profile.');
    if (!data) return null;

    const { data: favs } = await supabase.from('user_favorites').select('item_id').eq('user_id', uid);

    return {
      uid: data.id,
      email: data.email,
      role: data.role as UserRole,
      favorites: (favs || []).map((f) => f.item_id as string),
      createdAt: data.created_at,
    } as UserProfile;
  },

  async syncProfile(profile: Omit<UserProfile, 'createdAt'>) {
    const existing = await this.getProfile(profile.uid);
    if (existing) return;

    const { error } = await supabase.from('users').upsert({
      id: profile.uid,
      email: profile.email,
      role: profile.role || 'customer',
      disabled: false,
    });
    if (error) throwSb(error, 'Unable to sync profile.');
  },

  async toggleFavorite(uid: string, itemId: string) {
    const { data: existing } = await supabase
      .from('user_favorites')
      .select('item_id')
      .eq('user_id', uid)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', uid)
        .eq('item_id', itemId);
      if (error) throwSb(error, 'Unable to remove favorite.');
    } else {
      const { error } = await supabase.from('user_favorites').insert({ user_id: uid, item_id: itemId });
      if (error) throwSb(error, 'Unable to add favorite.');
    }
  },
};

export const PromotionService = {
  async getAllPromotions() {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throwSb(error, 'Unable to list promotions.');
    return (data || []).map(mapPromotion);
  },

  async addPromotion(promotion: Omit<Promotion, 'id' | 'createdAt'>) {
    const { data, error } = await supabase
      .from('promotions')
      .insert(promotionToRow(promotion))
      .select('id')
      .single();
    if (error) throwSb(error, 'Unable to create promotion.');
    return data.id as string;
  },

  async updatePromotion(id: string, updates: Partial<Promotion>) {
    const { error } = await supabase.from('promotions').update(promotionToRow(updates)).eq('id', id);
    if (error) throwSb(error, 'Unable to update promotion.');
  },

  async deletePromotion(id: string) {
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) throwSb(error, 'Unable to delete promotion.');
  },
};

export const AccountsService = {
  async getSettings() {
    const { data, error } = await supabase
      .from('accounts_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();
    if (error) throwSb(error, 'Unable to load accounts settings.');
    if (!data) return defaultAccountsSettings;
    return { ...defaultAccountsSettings, ...mapAccountsSettings(data) };
  },

  async saveSettings(settings: AccountsSettings) {
    const { error } = await supabase.from('accounts_settings').upsert({
      id: 'current',
      legal_name: settings.legalName,
      trade_name: settings.tradeName,
      gstin: settings.gstin,
      state_code: settings.stateCode,
      state_name: settings.stateName,
      invoice_prefix: settings.invoicePrefix,
      next_invoice_number: settings.nextInvoiceNumber,
      financial_year_label: settings.financialYearLabel,
      default_gst_rate: settings.defaultGstRate,
      default_tax_mode: settings.defaultTaxMode,
    });
    if (error) throwSb(error, 'Unable to save accounts settings.');
  },

  async getEntries() {
    const { data, error } = await supabase
      .from('accounts_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throwSb(error, 'Unable to list accounts entries.');
    return (data || []).map(mapEntry);
  },

  async addEntry(entry: Omit<AccountingEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await supabase
      .from('accounts_entries')
      .insert({
        source_order_id: entry.sourceOrderId || null,
        invoice_number: entry.invoiceNumber,
        invoice_date: entry.invoiceDate,
        customer_name: entry.customerName,
        customer_email: entry.customerEmail || null,
        customer_gstin: entry.customerGstin || null,
        place_of_supply: entry.placeOfSupply,
        item_summary: entry.itemSummary,
        taxable_amount: entry.taxableAmount,
        gst_rate: entry.gstRate,
        tax_mode: entry.taxMode,
        cgst_amount: entry.cgstAmount,
        sgst_amount: entry.sgstAmount,
        igst_amount: entry.igstAmount,
        total_amount: entry.totalAmount,
        payment_status: entry.paymentStatus,
        payment_method: entry.paymentMethod,
        notes: entry.notes || null,
      })
      .select('id')
      .single();
    if (error) throwSb(error, 'Unable to create accounts entry.');
    return data.id as string;
  },

  async updateEntry(id: string, updates: Partial<AccountingEntry>) {
    const row: Record<string, unknown> = {};
    if (updates.sourceOrderId !== undefined) row.source_order_id = updates.sourceOrderId;
    if (updates.invoiceNumber !== undefined) row.invoice_number = updates.invoiceNumber;
    if (updates.invoiceDate !== undefined) row.invoice_date = updates.invoiceDate;
    if (updates.customerName !== undefined) row.customer_name = updates.customerName;
    if (updates.customerEmail !== undefined) row.customer_email = updates.customerEmail;
    if (updates.customerGstin !== undefined) row.customer_gstin = updates.customerGstin;
    if (updates.placeOfSupply !== undefined) row.place_of_supply = updates.placeOfSupply;
    if (updates.itemSummary !== undefined) row.item_summary = updates.itemSummary;
    if (updates.taxableAmount !== undefined) row.taxable_amount = updates.taxableAmount;
    if (updates.gstRate !== undefined) row.gst_rate = updates.gstRate;
    if (updates.taxMode !== undefined) row.tax_mode = updates.taxMode;
    if (updates.cgstAmount !== undefined) row.cgst_amount = updates.cgstAmount;
    if (updates.sgstAmount !== undefined) row.sgst_amount = updates.sgstAmount;
    if (updates.igstAmount !== undefined) row.igst_amount = updates.igstAmount;
    if (updates.totalAmount !== undefined) row.total_amount = updates.totalAmount;
    if (updates.paymentStatus !== undefined) row.payment_status = updates.paymentStatus;
    if (updates.paymentMethod !== undefined) row.payment_method = updates.paymentMethod;
    if (updates.notes !== undefined) row.notes = updates.notes;

    const { error } = await supabase.from('accounts_entries').update(row).eq('id', id);
    if (error) throwSb(error, 'Unable to update accounts entry.');
  },

  async deleteEntry(id: string) {
    const { error } = await supabase.from('accounts_entries').delete().eq('id', id);
    if (error) throwSb(error, 'Unable to delete accounts entry.');
  },
};
