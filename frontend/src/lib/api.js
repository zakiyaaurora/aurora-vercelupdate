import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient";

const throwOn = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/* ------------------------------ Categories ------------------------------ */
export const listCategories = () =>
  supabase.from("categories").select("*").order("name").then(throwOn);
export const createCategory = (payload) =>
  supabase.from("categories").insert(payload).select().single().then(throwOn);
export const updateCategory = (id, payload) =>
  supabase.from("categories").update(payload).eq("id", id).select().single().then(throwOn);
export const deleteCategory = (id) =>
  supabase.from("categories").delete().eq("id", id).then(throwOn);

/* ------------------------------ Products -------------------------------- */
export const listProducts = () =>
  supabase.from("products").select("*, category:categories(id,name)").order("created_at", { ascending: false }).then(throwOn);
export const getProduct = (id) =>
  supabase.from("products").select("*, category:categories(id,name)").eq("id", id).single().then(throwOn);
export const createProduct = (payload) =>
  supabase.from("products").insert(payload).select().single().then(throwOn);
export const updateProduct = (id, payload) =>
  supabase.from("products").update(payload).eq("id", id).select().single().then(throwOn);
export const deleteProduct = (id) =>
  supabase.from("products").delete().eq("id", id).then(throwOn);

/* ------------------------------ Inventory ------------------------------- */
export const listInventory = () =>
  supabase.from("inventory_items").select("*, product:products(id,name,product_code,rental_price)").order("created_at", { ascending: false }).then(throwOn);
export const listInventoryByProduct = (productId) =>
  supabase.from("inventory_items").select("*").eq("product_id", productId).order("sku").then(throwOn);
export const createInventory = (payload) =>
  supabase.from("inventory_items").insert(payload).select().single().then(throwOn);
export const updateInventory = (id, payload) =>
  supabase.from("inventory_items").update(payload).eq("id", id).select().single().then(throwOn);
export const deleteInventory = (id) =>
  supabase.from("inventory_items").delete().eq("id", id).then(throwOn);

/* ------------------------------ Customers ------------------------------- */
export const listCustomers = () =>
  supabase.from("customers").select("*").order("created_at", { ascending: false }).then(throwOn);
export const getCustomer = (id) =>
  supabase.from("customers").select("*").eq("id", id).single().then(throwOn);
export const createCustomer = (payload) =>
  supabase.from("customers").insert(payload).select().single().then(throwOn);
export const updateCustomer = (id, payload) =>
  supabase.from("customers").update(payload).eq("id", id).select().single().then(throwOn);
export const deleteCustomer = (id) =>
  supabase.from("customers").delete().eq("id", id).then(throwOn);

export const customerHistory = async (id) => {
  const [bookings, rentals, payments, invoices] = await Promise.all([
    supabase.from("bookings").select("*").eq("customer_id", id).order("created_at", { ascending: false }).then(throwOn),
    supabase.from("rentals").select("*").eq("customer_id", id).order("created_at", { ascending: false }).then(throwOn),
    supabase.from("payments").select("*").eq("customer_id", id).order("created_at", { ascending: false }).then(throwOn),
    supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false }).then(throwOn),
  ]);
  return { bookings, rentals, payments, invoices };
};

/* ------------------------------ Bookings -------------------------------- */
export const listBookings = () =>
  supabase.from("bookings").select("*, customer:customers(id,name,phone)").order("created_at", { ascending: false }).then(throwOn);
export const getBooking = (id) =>
  supabase.from("bookings").select("*, customer:customers(*), items:booking_items(*, product:products(id,name,product_code), inventory:inventory_items(id,sku))").eq("id", id).single().then(throwOn);
export const createBooking = (payload) =>
  supabase.rpc("create_booking", { p: payload }).then(throwOn);
export const updateBookingStatus = (id, status) =>
  supabase.from("bookings").update({ status }).eq("id", id).select().single().then(throwOn);
export const checkAvailability = (productId, startDate, endDate) =>
  supabase.rpc("check_availability", { p_product_id: productId, p_start: startDate, p_end: endDate }).then(throwOn);

/* ------------------------------- Rentals -------------------------------- */
export const listRentals = () =>
  supabase.from("rentals").select("*, customer:customers(id,name,phone)").order("created_at", { ascending: false }).then(throwOn);
export const getRental = (id) =>
  supabase.from("rentals").select("*, customer:customers(*), items:rental_items(*, product:products(id,name,product_code), inventory:inventory_items(id,sku))").eq("id", id).single().then(throwOn);
export const checkoutRental = (bookingId, pickupDate) =>
  supabase.rpc("checkout_rental", { p_booking_id: bookingId, p_pickup: pickupDate }).then(throwOn);
export const returnRental = (payload) =>
  supabase.rpc("return_rental", { p: payload }).then(throwOn);

/* ------------------------------- Invoices ------------------------------- */
export const listInvoices = () =>
  supabase.from("invoices").select("*, customer:customers(id,name,phone,address)").order("created_at", { ascending: false }).then(throwOn);
export const getInvoice = (id) =>
  supabase.from("invoices").select("*, customer:customers(*), booking:bookings(*, items:booking_items(*, product:products(id,name,product_code))), payments:payments(*)").eq("id", id).single().then(throwOn);

/* ------------------------------- Payments ------------------------------- */
export const listPayments = () =>
  supabase.from("payments").select("*, customer:customers(id,name), invoice:invoices(id,invoice_number)").order("created_at", { ascending: false }).then(throwOn);
export const addPayment = (payload) =>
  supabase.rpc("add_payment", { p: payload }).then(throwOn);

/* ---------------------------- Stock movements --------------------------- */
export const listStockMovements = () =>
  supabase.from("stock_movements").select("*, product:products(id,name), inventory:inventory_items(id,sku)").order("created_at", { ascending: false }).limit(200).then(throwOn);
export const createStockMovement = (payload) =>
  supabase.from("stock_movements").insert(payload).select().single().then(throwOn);

/* ------------------------------- Dashboard ------------------------------ */
export const dashboardStats = () => supabase.rpc("dashboard_stats").then(throwOn);

/* ------------------------------ Audit logs ------------------------------ */
export const listAuditLogs = () =>
  supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200).then(throwOn);

/* --------------------------------- Users -------------------------------- */
export const listUsers = () =>
  supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(throwOn);
export const updateUser = (id, payload) =>
  supabase.from("profiles").update(payload).eq("id", id).select().single().then(throwOn);
export const deleteUser = (id) =>
  supabase.from("profiles").delete().eq("id", id).then(throwOn);

// Creates an auth user without disturbing the current admin session
export const createUser = async ({ email, password, name, role, phone }) => {
  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await tmp.auth.signUp({
    email,
    password,
    options: { data: { name, role, phone } },
  });
  if (error) throw error;
  return data;
};

/* -------------------------------- Settings ------------------------------ */
export const getSetting = (key) =>
  supabase.from("settings").select("*").eq("key", key).maybeSingle().then(throwOn);
export const saveSetting = (key, value) =>
  supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }).select().single().then(throwOn);

/* -------------------------------- Reports ------------------------------- */
export const reportPayments = (start, end) =>
  supabase.from("payments").select("*, customer:customers(id,name)").gte("payment_date", start).lte("payment_date", end).order("payment_date").then(throwOn);
export const reportBookings = (start, end) =>
  supabase.from("bookings").select("*, customer:customers(id,name)").gte("booking_date", start).lte("booking_date", end).order("booking_date").then(throwOn);
export const reportRentals = (start, end) =>
  supabase.from("rentals").select("*, customer:customers(id,name)").gte("pickup_date", start).lte("pickup_date", end).order("pickup_date").then(throwOn);
