import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  InputAdornment,
  Autocomplete,
  Avatar,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Alert,
  MenuItem,
  Stack,
} from "@mui/material";
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  Package,
  ReceiptText,
  Search,
  Share2,
  ShoppingBag,
  UserRound,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import {
  addOrder,
  type OrderStatus,
  type Order,
  type OrderPaymentMethod,
  type OrderLineItem,
} from "../../features/orders/ordersSlice";
import {
  fetchProducts,
  resolveProductImage,
  placeholderFallback,
  type Product,
} from "../../features/inventory/inventorySlice";
import {
  addTransactionApi,
  fetchTransactions,
} from "../../features/transactions/transactionSlice";
import { alpha, useTheme } from "@mui/material/styles";
import type { AppDispatch } from "../../store";
import useAppCurrency from "../../hooks/useAppCurrency";
import api from "../../api/axios";
import {
  getCitiesForProvince,
  pakistanProvinces,
} from "../../lib/pakistanLocations";
import { createHiddenCustomerId } from "../../lib/customerIdentity";
import { getProductUnitLabel } from "../../lib/productUnits";

type CustomerType = "regular" | "credit" | "installment" | "wholesale";
type CustomerStatus = "active" | "inactive";

interface Customer {
  _id: string;
  fullName: string;
  cnic?: string;
  phoneNumber: string;
  amount: number;
  email?: string;
  address?: string;
  province?: string;
  city?: string;
  customerType: CustomerType;
  status: CustomerStatus;
  notes?: string;
}

interface CreditCustomer {
  customerName: string;
  customerCnic: string;
  outstandingAmount: number;
}

interface CreateCustomerOption {
  _id: "new-customer-action";
  fullName: string;
  isCreateAction: true;
}

type CustomerOption = Customer | CreateCustomerOption;

const initialCustomerForm = {
  fullName: "",
  phoneNumber: "",
  amount: 0,
  email: "",
  address: "",
  province: "",
  city: "",
  customerType: "regular" as CustomerType,
  status: "active" as CustomerStatus,
  notes: "",
};

const createCustomerOption: CreateCustomerOption = {
  _id: "new-customer-action",
  fullName: "New Customer",
  isCreateAction: true,
};

const isCreateCustomerOption = (
  option: CustomerOption,
): option is CreateCustomerOption => "isCreateAction" in option;

const paymentMethodLabels: Record<OrderPaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  credit: "Credit",
  installment: "EMI",
};

const paymentOptions: Array<{
  value: OrderPaymentMethod;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "cash", label: "Cash", icon: <Banknote size={18} /> },
  { value: "credit", label: "Credit", icon: <BadgeDollarSign size={18} /> },
];

const ANONYMOUS_CUSTOMER_NAME = "Anonymous";

const getLineProductLabel = (lineItems?: OrderLineItem[], fallback = "") => {
  if (!lineItems?.length) return fallback;
  if (lineItems.length === 1) return lineItems[0].productName;
  return `${lineItems[0].productName} + ${lineItems.length - 1} more`;
};

const getTransactionOrderId = (transactionId: string) => {
  if (!transactionId.startsWith("ORD-")) return transactionId;
  const rawOrderId = transactionId.replace(/^ORD-/, "");
  return rawOrderId.replace(/-L\d+$/, "");
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as {
    response?: { data?: { message?: string; details?: string } };
  };
  const data = maybeError.response?.data;
  return data?.details || data?.message || fallback;
};

const buildCustomerCreditKey = (name?: string, cnic?: string) =>
  `${String(name || "").trim().toLowerCase()}::${String(cnic || "")
    .trim()
    .toLowerCase()}`;

const OrderDesk: React.FC = () => {
  const theme = useTheme();
  const { formatCurrency, currencySymbol } = useAppCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const { products } = useSelector((state: RootState) => state.inventory);
  const { user } = useSelector((state: RootState) => state.auth);
  const { orders } = useSelector((state: RootState) => state.orders);
  const { transactions, loading: transactionLoading } = useSelector(
    (state: RootState) => state.transactions,
  );
  const isManager = user?.role === "super_admin" || user?.role === "admin";

  const calculateOrderAmount = (rateValue: number | string, qtyValue: number | string) => {
    const qtyNumber = Math.max(0, parseInt(qtyValue.toString() || "0"));
    const rateNumber = Math.max(0, Number(rateValue || 0));
    if (qtyNumber <= 0 || rateNumber <= 0) return "";
    return Number((qtyNumber * rateNumber).toFixed(2));
  };

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [rate, setRate] = useState<number | string>("");
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerName, setCustomerName] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<OrderPaymentMethod>("cash");
  const [pendingPaymentMethod, setPendingPaymentMethod] =
    useState<OrderPaymentMethod | null>(null);
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [creditPaymentOpen, setCreditPaymentOpen] = useState(false);
  const [creditPaidInput, setCreditPaidInput] = useState("");
  const [creditPaidNow, setCreditPaidNow] = useState(0);
  const [creditDue, setCreditDue] = useState(0);
  const [creditPreviousAdjustment, setCreditPreviousAdjustment] = useState(0);
  const [note, setNote] = useState("");
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [printTarget, setPrintTarget] = useState<"orders" | "invoice">(
    "orders",
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchTransactions());
  }, [dispatch]);

  useEffect(() => {
    const resetPrintTarget = () => setPrintTarget("orders");
    window.addEventListener("afterprint", resetPrintTarget);
    return () => window.removeEventListener("afterprint", resetPrintTarget);
  }, []);

  const loadCustomers = React.useCallback(async () => {
    try {
      const response = await api.get<Customer[]>("/customers");
      setCustomers(response.data || []);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getApiErrorMessage(error, "Unable to load customers."),
      });
    }
  }, []);

  const loadCreditCustomers = React.useCallback(async () => {
    try {
      const response = await api.get<CreditCustomer[]>("/credits/customers");
      setCreditCustomers(response.data || []);
    } catch {
      setCreditCustomers([]);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    loadCreditCustomers();
  }, [loadCustomers, loadCreditCustomers]);

  const availableStock = selectedProduct?.stock ?? 0;
  const requestedQty = Math.max(0, parseInt(quantity.toString() || "0"));
  const numericRate = Math.max(0, Number(rate || 0));
  const lineAmount = calculateOrderAmount(numericRate, requestedQty);
  const selectedProductUnitLabel = selectedProduct
    ? getProductUnitLabel(
        selectedProduct.productUnitCode,
        selectedProduct.productUnit,
        selectedProduct.productUnitUrdu,
      )
    : "";
  const pendingLineComplete = Boolean(
    selectedProduct && requestedQty > 0 && numericRate > 0 && Number(lineAmount || 0) > 0,
  );
  const pendingLineStarted = Boolean(
    selectedProduct || numericRate > 0 || quantity.toString() !== "1",
  );
  const pendingLineItem = useMemo<OrderLineItem | null>(() => {
    if (!selectedProduct || !pendingLineComplete) return null;
    return {
      lineId: `${selectedProduct.id}-pending`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: requestedQty,
      rate: numericRate,
      amount: Number(lineAmount || 0),
      productUnitCode: selectedProduct.productUnitCode,
      productUnit: selectedProduct.productUnit,
      productUnitUrdu: selectedProduct.productUnitUrdu,
    };
  }, [lineAmount, numericRate, pendingLineComplete, requestedQty, selectedProduct]);
  const orderLinesForSubmit = useMemo(
    () => [...lineItems, ...(pendingLineItem ? [pendingLineItem] : [])],
    [lineItems, pendingLineItem],
  );
  const currentOrderTotal = orderLinesForSubmit.reduce(
    (sum, line) => sum + Number(line.amount || 0),
    0,
  );
  const selectedCreditCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    const selectedKey = buildCustomerCreditKey(
      selectedCustomer.fullName,
      selectedCustomer.cnic,
    );
    return (
      creditCustomers.find(
        (customer) =>
          buildCustomerCreditKey(
            customer.customerName,
            customer.customerCnic,
          ) === selectedKey,
      ) || null
    );
  }, [creditCustomers, selectedCustomer]);
  const selectedCustomerClosingCredit = selectedCustomer
    ? Number(selectedCustomer.amount || 0)
    : 0;
  const selectedCustomerTransactionCredit = selectedCustomer
    ? Number(selectedCreditCustomer?.outstandingAmount || 0)
    : 0;
  const selectedCustomerCreditBalance =
    selectedCustomerClosingCredit + selectedCustomerTransactionCredit;
  const rawCreditPaidInput = Math.max(Number(creditPaidInput || 0), 0);
  const maxCreditPayment = currentOrderTotal + selectedCustomerCreditBalance;
  const draftCreditPaid = Math.min(
    rawCreditPaidInput,
    maxCreditPayment,
  );
  const draftCreditPaidForOrder = Math.min(draftCreditPaid, currentOrderTotal);
  const draftCreditDue = Math.max(currentOrderTotal - draftCreditPaidForOrder, 0);
  const draftCreditPreviousAdjustment = Math.min(
    Math.max(draftCreditPaid - currentOrderTotal, 0),
    selectedCustomerCreditBalance,
  );
  const draftCreditClosingAdjustment = Math.min(
    draftCreditPreviousAdjustment,
    selectedCustomerClosingCredit,
  );
  const draftCreditTransactionAdjustment = Math.max(
    draftCreditPreviousAdjustment - draftCreditClosingAdjustment,
    0,
  );
  const draftCreditRemainingPrevious = Math.max(
    selectedCustomerCreditBalance - draftCreditPreviousAdjustment,
    0,
  );
  const draftCreditTotalToReceive =
    draftCreditRemainingPrevious + draftCreditDue;
  const stockCheck = useMemo(() => {
    const requestedByProduct = orderLinesForSubmit.reduce<Record<string, number>>(
      (acc, line) => {
        acc[line.productId] = (acc[line.productId] || 0) + line.quantity;
        return acc;
      },
      {},
    );
    return Object.entries(requestedByProduct).every(([productId, qty]) => {
      const product = products.find((item) => item.id === productId);
      return Boolean(product && qty <= product.stock);
    });
  }, [orderLinesForSubmit, products]);
  const enoughStock = orderLinesForSubmit.length > 0 && stockCheck;
  const currentLineHasStock =
    Boolean(selectedProduct) && requestedQty > 0 && requestedQty <= availableStock;
  const availabilityLabel = useMemo(() => {
    if (!selectedProduct || requestedQty <= 0)
      return "Select product and quantity";
    if (currentLineHasStock)
      return `Available: ${availableStock} ${selectedProductUnitLabel} in stock`;
    const shortBy = requestedQty - availableStock;
    return `Short by ${shortBy} ${selectedProductUnitLabel || "unit"}`;
  }, [selectedProduct, requestedQty, availableStock, currentLineHasStock, selectedProductUnitLabel]);

  const availabilityColor: OrderStatus | "neutral" =
    !selectedProduct || requestedQty <= 0
      ? "neutral"
      : currentLineHasStock
        ? "fulfilled"
        : "rejected";
  const canAddCurrentLine = Boolean(
    pendingLineItem && currentLineHasStock,
  );
  const canSubmitOrder = Boolean(
    orderLinesForSubmit.length > 0 &&
    currentOrderTotal > 0 &&
    (!pendingLineStarted || pendingLineComplete) &&
    !transactionLoading,
  );

  const openNewCustomerDialog = () => {
    if (!isManager) return;
    setCustomerForm({
      ...initialCustomerForm,
      fullName: customerName.trim(),
    });
    setCustomerDialogOpen(true);
  };

  const customerOptions = useMemo<CustomerOption[]>(
    () => [
      ...(isManager ? [createCustomerOption] : []),
      ...customers.filter((customer) => customer.status === "active"),
    ],
    [customers, isManager],
  );
  const customerCityOptions = useMemo(
    () =>
      customerForm.province ? getCitiesForProvince(customerForm.province) : [],
    [customerForm.province],
  );

  const resetPendingLine = () => {
    setSelectedProduct(null);
    setQuantity(1);
    setRate("");
  };

  const resetOrderForm = () => {
    resetPendingLine();
    setLineItems([]);
    setSelectedCustomer(null);
    setCustomerName("");
    setPaymentMethod("cash");
    setPendingPaymentMethod(null);
    setConfirmPaymentOpen(false);
    setCreditPaymentOpen(false);
    setCreditPaidInput("");
    setCreditPaidNow(0);
    setCreditDue(0);
    setCreditPreviousAdjustment(0);
    setNote("");
  };

  const handleAddLineItem = () => {
    if (!pendingLineItem || !selectedProduct) {
      setFeedback({
        type: "error",
        message: "Select product, quantity, and rate before adding the line.",
      });
      return;
    }

    const existingQtyForProduct = lineItems
      .filter((line) => line.productId === pendingLineItem.productId)
      .reduce((sum, line) => sum + line.quantity, 0);

    if (existingQtyForProduct + pendingLineItem.quantity > selectedProduct.stock) {
      setFeedback({
        type: "error",
        message: `Only ${selectedProduct.stock} ${selectedProductUnitLabel} available for ${selectedProduct.name}.`,
      });
      return;
    }

    setLineItems((current) => [
      ...current,
      {
        ...pendingLineItem,
        lineId: `${pendingLineItem.productId}-${Date.now()}`,
      },
    ]);
    resetPendingLine();
  };

  const handleRemoveLineItem = (lineId: string) => {
    setLineItems((current) => current.filter((line) => line.lineId !== lineId));
  };

  const validateOrderBeforePayment = () => {
    if (pendingLineStarted && !pendingLineComplete) {
      setFeedback({
        type: "error",
        message: "Complete the selected product line or clear it before placing the order.",
      });
      return false;
    }

    if (orderLinesForSubmit.length === 0) {
      setFeedback({
        type: "error",
        message: "Add at least one product before payment.",
      });
      return false;
    }

    return true;
  };

  const handleStartPayment = (method: OrderPaymentMethod) => {
    if (!validateOrderBeforePayment()) return;

    setPaymentMethod(method);

    if (!enoughStock) {
      void executeOrder(method, 0, currentOrderTotal);
      return;
    }

    if (method === "credit") {
      setCreditPaidInput("");
      setCreditPaymentOpen(true);
      return;
    }

    setCreditPaidNow(0);
    setCreditDue(0);
    setCreditPreviousAdjustment(0);
    setPendingPaymentMethod(method);
    setConfirmPaymentOpen(true);
  };

  const handleContinueCreditPayment = () => {
    if (!selectedCustomer) {
      setFeedback({
        type: "error",
        message: "Select an existing customer for credit orders.",
      });
      return;
    }

    if (rawCreditPaidInput > maxCreditPayment) {
      setFeedback({
        type: "error",
        message: `Payment cannot exceed order total plus previous credit (${formatCurrency(maxCreditPayment, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}).`,
      });
      return;
    }

    if (draftCreditDue <= 0 && draftCreditPreviousAdjustment <= 0) {
      setFeedback({
        type: "error",
        message: "Use Cash for full payment. Credit needs current due or old-credit adjustment.",
      });
      return;
    }

    setCreditPaidNow(draftCreditPaidForOrder);
    setCreditDue(draftCreditDue);
    setCreditPreviousAdjustment(draftCreditPreviousAdjustment);
    setPendingPaymentMethod("credit");
    setCreditPaymentOpen(false);
    setConfirmPaymentOpen(true);
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    handleStartPayment(paymentMethod);
  };

  const handleConfirmPayment = () => {
    if (!pendingPaymentMethod) return;
    const confirmedPaidNow =
      pendingPaymentMethod === "credit" ? creditPaidNow : currentOrderTotal;
    const confirmedDueAmount =
      pendingPaymentMethod === "credit" ? creditDue : 0;
    const confirmedPreviousAdjustment =
      pendingPaymentMethod === "credit" ? creditPreviousAdjustment : 0;
    void executeOrder(
      pendingPaymentMethod,
      confirmedPaidNow,
      confirmedDueAmount,
      confirmedPreviousAdjustment,
    );
  };

  const applyPreviousCreditAdjustment = async (
    customer: Customer | null,
    amount: number,
  ) => {
    if (!customer || amount <= 0) return 0;

    let remainingAdjustment = amount;
    const closingAdjustment = Math.min(
      remainingAdjustment,
      Number(customer.amount || 0),
    );

    if (closingAdjustment > 0) {
      const updatedAmount = Math.max(
        Number(customer.amount || 0) - closingAdjustment,
        0,
      );
      const response = await api.patch<Customer>(`/customers/${customer._id}`, {
        fullName: customer.fullName,
        cnic: customer.cnic || createHiddenCustomerId(),
        phoneNumber: customer.phoneNumber,
        amount: updatedAmount,
        email: customer.email || "",
        address: customer.address || "",
        province: customer.province || "",
        city: customer.city || "",
        customerType: customer.customerType,
        status: customer.status,
        notes: customer.notes || "",
      });

      setCustomers((current) =>
        current.map((entry) =>
          entry._id === response.data._id ? response.data : entry,
        ),
      );
      remainingAdjustment = Number(
        (remainingAdjustment - closingAdjustment).toFixed(2),
      );
    }

    if (remainingAdjustment > 0) {
      await api.post("/credits/payments", {
        customerName: customer.fullName,
        customerCnic: customer.cnic || "",
        amount: remainingAdjustment,
        paidVia: "cash",
        notes: "Adjusted from Order Desk overpayment.",
      });
    }

    await Promise.all([loadCustomers(), loadCreditCustomers()]);
    return amount;
  };

  const executeOrder = async (
    confirmedPaymentMethod: OrderPaymentMethod,
    confirmedPaidNow: number,
    confirmedDueAmount: number,
    confirmedPreviousAdjustment = 0,
  ) => {
    if (!validateOrderBeforePayment()) return;

    const cleanCustomerName = customerName.trim() || ANONYMOUS_CUSTOMER_NAME;
    const totalQuantity = orderLinesForSubmit.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );
    const primaryProduct = orderLinesForSubmit[0];
    const orderProductName = getLineProductLabel(
      orderLinesForSubmit,
      primaryProduct.productName,
    );

    if (!enoughStock) {
      const orderId = Math.random().toString(36).slice(2, 9).toUpperCase();
      const timestamp = new Date().toISOString();
      const requestedBy = user?.name || "Admin";

      dispatch(
        addOrder({
          id: orderId,
          productId: primaryProduct.productId,
          productName: orderProductName,
          quantity: totalQuantity,
          lineItems: orderLinesForSubmit,
          customerName: cleanCustomerName,
          orderAmount: currentOrderTotal,
          requestedBy,
          status: "rejected",
          timestamp,
          notes: note.trim() || "Insufficient stock",
          paymentMethod: confirmedPaymentMethod,
          paidNow: 0,
          dueAmount: currentOrderTotal,
        }),
      );

      setFeedback({
        type: "error",
        message: `Order ${orderId} rejected due to insufficient stock.`,
      });
      setConfirmPaymentOpen(false);
      setPendingPaymentMethod(null);
      resetOrderForm();
      return;
    }

    const orderId = Math.random().toString(36).slice(2, 9).toUpperCase();
    const timestamp = new Date().toISOString();
    const requestedBy = user?.name || "Admin";

    const results = [];
    for (const [index, line] of orderLinesForSubmit.entries()) {
      const orderTx = {
        id: `ORD-${orderId}-L${index + 1}`,
        productId: line.productId,
        productName: line.productName,
        type: "reduction" as const,
        amount: line.quantity,
        userName: requestedBy,
        timestamp,
        totalPrice: line.amount,
        unitPrice: line.rate,
        customerName: cleanCustomerName,
        customerCnic: selectedCustomer?.cnic || "",
        paymentMethod: confirmedPaymentMethod,
        paidVia: confirmedPaymentMethod === "credit" ? ("cash" as const) : undefined,
        paidNow:
          currentOrderTotal > 0
            ? Number(((line.amount / currentOrderTotal) * confirmedPaidNow).toFixed(2))
            : 0,
        dueAmount:
          currentOrderTotal > 0
            ? Number(((line.amount / currentOrderTotal) * confirmedDueAmount).toFixed(2))
            : 0,
      };
      results.push(await dispatch(addTransactionApi(orderTx)));
    }

    const failedResult = results.find(
      (result) => !addTransactionApi.fulfilled.match(result),
    );

    if (!failedResult) {
      let previousAdjustmentApplied = false;
      if (confirmedPreviousAdjustment > 0) {
        try {
          await applyPreviousCreditAdjustment(
            selectedCustomer,
            confirmedPreviousAdjustment,
          );
          previousAdjustmentApplied = true;
        } catch (error: unknown) {
          setFeedback({
            type: "error",
            message: getApiErrorMessage(
              error,
              "Order placed, but previous credit could not be adjusted.",
            ),
          });
        }
      }

      dispatch(
        addOrder({
          id: orderId,
          productId: primaryProduct.productId,
          productName: orderProductName,
          quantity: totalQuantity,
          lineItems: orderLinesForSubmit,
          customerName: cleanCustomerName,
          orderAmount: currentOrderTotal,
          requestedBy,
          status: "fulfilled",
          timestamp,
          notes: note.trim() || undefined,
          paymentMethod: confirmedPaymentMethod,
          paidNow: confirmedPaidNow,
          dueAmount: confirmedDueAmount,
        }),
      );
      dispatch(fetchProducts());
      dispatch(fetchTransactions());
      void loadCreditCustomers();
      if (confirmedPreviousAdjustment <= 0 || previousAdjustmentApplied) {
        setFeedback({
          type: "success",
          message:
            confirmedPreviousAdjustment > 0
              ? `Order ${orderId} placed. ${formatCurrency(confirmedPreviousAdjustment, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} adjusted from previous credit.`
              : `Order ${orderId} placed and stock updated.`,
        });
      }
      setConfirmPaymentOpen(false);
      setPendingPaymentMethod(null);
      resetOrderForm();
      return;
    }

    setFeedback({
      type: "error",
      message:
        typeof failedResult.payload === "string"
          ? failedResult.payload
          : `Order ${orderId} could not be placed.`,
    });
  };

  const handleCustomerFormChange = (
    field: keyof typeof initialCustomerForm,
    value: string | number,
  ) => {
    setCustomerForm((current) => ({ ...current, [field]: value }));
  };

  const handleCustomerProvinceChange = (province: string) => {
    setCustomerForm((current) => ({ ...current, province, city: "" }));
  };

  const resetCustomerDialog = () => {
    setCustomerForm(initialCustomerForm);
    setCustomerDialogOpen(false);
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.fullName.trim()) {
      setFeedback({
        type: "error",
        message: "Customer full name is required.",
      });
      return;
    }
    if (!customerForm.phoneNumber.trim()) {
      setFeedback({
        type: "error",
        message: "Customer phone number is required.",
      });
      return;
    }

    setCustomerSaving(true);
    try {
      const payload = {
        ...customerForm,
        cnic: createHiddenCustomerId(),
        fullName: customerForm.fullName.trim(),
        phoneNumber: customerForm.phoneNumber.trim(),
        amount: Number(customerForm.amount || 0),
        email: customerForm.email.trim(),
        address: customerForm.address.trim(),
        province: customerForm.province.trim(),
        city: customerForm.city.trim(),
        notes: customerForm.notes.trim(),
      };
      const response = await api.post<Customer>("/customers", payload);
      setCustomers((current) => [response.data, ...current]);
      setSelectedCustomer(response.data);
      setCustomerName(response.data.fullName);
      resetCustomerDialog();
      setFeedback({
        type: "success",
        message: "Customer created and selected for this order.",
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getApiErrorMessage(error, "Unable to create customer."),
      });
    } finally {
      setCustomerSaving(false);
    }
  };

  const fulfilledOrdersFromTransactions: Order[] = useMemo(() => {
    const productLookup = new Map(products.map((product) => [product.id, product]));
    const grouped = new Map<string, Order>();

    transactions
      .filter((tx) => tx.type === "reduction")
      .forEach((tx) => {
        const orderId = getTransactionOrderId(tx.id);
        const product = productLookup.get(tx.productId);
        const lineAmount = Number(tx.totalPrice || 0);
        const lineQuantity = Number(tx.amount || 0);
        const lineRate = Number(tx.unitPrice || (lineQuantity ? lineAmount / lineQuantity : 0));
        const lineItem: OrderLineItem = {
          lineId: tx.id,
          productId: tx.productId,
          productName: tx.productName,
          quantity: lineQuantity,
          rate: lineRate,
          amount: lineAmount,
          productUnitCode: product?.productUnitCode,
          productUnit: product?.productUnit,
          productUnitUrdu: product?.productUnitUrdu,
        };
        const existing = grouped.get(orderId);

        if (!existing) {
          grouped.set(orderId, {
            id: orderId,
            productId: tx.productId,
            productName: tx.productName,
            quantity: lineQuantity,
            lineItems: [lineItem],
            customerName: tx.customerName || ANONYMOUS_CUSTOMER_NAME,
            orderAmount: lineAmount,
            requestedBy: tx.userName,
            status: "fulfilled" as const,
            timestamp: tx.timestamp,
            notes: undefined,
            paymentMethod: tx.paymentMethod || "cash",
            paidNow: Number(tx.paidNow || 0),
            dueAmount: Number(tx.dueAmount || 0),
          });
          return;
        }

        existing.lineItems = [...(existing.lineItems || []), lineItem];
        existing.productName = getLineProductLabel(existing.lineItems, existing.productName);
        existing.quantity += lineQuantity;
        existing.orderAmount = Number(existing.orderAmount || 0) + lineAmount;
        existing.paidNow = Number(existing.paidNow || 0) + Number(tx.paidNow || 0);
        existing.dueAmount = Number(existing.dueAmount || 0) + Number(tx.dueAmount || 0);
      });

    return Array.from(grouped.values()).map((order) => ({
      ...order,
      productName: getLineProductLabel(order.lineItems, order.productName),
    }));
  }, [transactions, products]);

  const filteredOrders = useMemo(() => {
    const combinedOrders = [
      ...orders.filter((order) => order.status !== "fulfilled"),
      ...fulfilledOrdersFromTransactions,
    ];
    const text = filterText.trim().toLowerCase();
    return combinedOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      if (!matchesStatus) return false;
      if (!text) return true;
      return (
        order.id.toLowerCase().includes(text) ||
        order.productName.toLowerCase().includes(text) ||
        (order.customerName || "").toLowerCase().includes(text) ||
        order.requestedBy.toLowerCase().includes(text)
      );
    });
  }, [orders, fulfilledOrdersFromTransactions, filterText, statusFilter]);

  const selectedCustomerPreviousOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const selectedName = selectedCustomer.fullName.trim().toLowerCase();
    return fulfilledOrdersFromTransactions
      .filter(
        (order) =>
          (order.customerName || "").trim().toLowerCase() === selectedName,
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [fulfilledOrdersFromTransactions, selectedCustomer]);

  const selectedCustomerPreviousSummary = useMemo(
    () =>
      selectedCustomerPreviousOrders.reduce(
        (acc, order) => {
          acc.orders += 1;
          acc.quantity += Number(order.quantity || 0);
          acc.amount += Number(order.orderAmount || 0);
          acc.paid += Number(order.paidNow || 0);
          acc.due += Number(order.dueAmount || 0);
          return acc;
        },
        { orders: 0, quantity: 0, amount: 0, paid: 0, due: 0 },
      ),
    [selectedCustomerPreviousOrders],
  );

  const selectedCustomerRecentLines = useMemo(
    () =>
      selectedCustomerPreviousOrders
        .flatMap((order) =>
          (order.lineItems?.length
            ? order.lineItems
            : [
                {
                  lineId: order.id,
                  productId: order.productId,
                  productName: order.productName,
                  quantity: order.quantity,
                  rate:
                    order.quantity > 0
                      ? Number(order.orderAmount || 0) / order.quantity
                      : 0,
                  amount: Number(order.orderAmount || 0),
                },
              ]
          ).map((line) => ({
            ...line,
            orderId: order.id,
            timestamp: order.timestamp,
            paymentMethod: order.paymentMethod || "cash",
          })),
        )
        .slice(0, 8),
    [selectedCustomerPreviousOrders],
  );

  const exportOrdersToCSV = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Product",
      "Quantity",
      "Amount",
      "Payment",
      "Status",
      "Reason",
      "Requested By",
      "Time",
    ];
    const rows = filteredOrders.map((order) => [
      order.id,
      order.customerName || "",
      getLineProductLabel(order.lineItems, order.productName),
      order.quantity.toString(),
      String(order.orderAmount || 0),
      paymentMethodLabels[order.paymentMethod || "cash"],
      order.status,
      order.notes || "",
      order.requestedBy,
      new Date(order.timestamp).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `orders_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    setPrintTarget("orders");
    window.setTimeout(() => window.print(), 0);
  };

  const handlePrintInvoice = () => {
    setPrintTarget("invoice");
    window.setTimeout(() => window.print(), 0);
  };

  const buildInvoiceShareText = (order: Order) => {
    const lines = order.lineItems?.length
      ? order.lineItems
      : [
          {
            lineId: order.id,
            productId: order.productId,
            productName: order.productName,
            quantity: order.quantity,
            rate:
              order.quantity > 0
                ? Number(order.orderAmount || 0) / order.quantity
                : 0,
            amount: Number(order.orderAmount || 0),
          },
        ];

    const itemLines = lines
      .map(
        (line) =>
          `- ${line.productName} x${line.quantity} = ${formatCurrency(line.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      )
      .join("\n");

    return [
      `Order Invoice #${order.id}`,
      `Date: ${new Date(order.timestamp).toLocaleString()}`,
      `Customer: ${order.customerName || ANONYMOUS_CUSTOMER_NAME}`,
      `Payment Method: ${paymentMethodLabels[order.paymentMethod || "cash"]}`,
      `Status: ${order.status}`,
      "",
      itemLines,
      "",
      `Total: ${formatCurrency(order.orderAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      `Paid Now: ${formatCurrency(order.paidNow || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      `Amount To Receive: ${formatCurrency(order.dueAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
    ].join("\n");
  };

  const handleShareInvoice = async () => {
    if (!invoiceOrder) return;
    const shareText = buildInvoiceShareText(invoiceOrder);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invoiceOrder.id}`,
          text: shareText,
        });
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setFeedback({ type: "error", message: "Could not share invoice." });
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setFeedback({
        type: "success",
        message: "Invoice details copied to clipboard.",
      });
    } catch {
      setFeedback({ type: "error", message: "Could not share invoice." });
    }
  };

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        if (order.status === "fulfilled") acc.fulfilled += 1;
        if (order.status === "rejected") acc.rejected += 1;
        if (order.status === "pending") acc.pending += 1;
        acc.amount += Number(order.orderAmount || 0);
        return acc;
      },
      { total: 0, fulfilled: 0, rejected: 0, pending: 0, amount: 0 },
    );
  }, [filteredOrders]);

  return (
    <Box>
      <Box
        className="section-rise"
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.16),
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.success.main, 0.08)} 48%, ${alpha(theme.palette.warning.main, 0.1)})`,
          boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={900}>
              Order Desk
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Check availability, place customer orders, and auto-deduct
              inventory in one flow.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<ShoppingBag size={16} />}
              label={`${summary.total} Orders`}
              sx={{ fontWeight: 800, bgcolor: "background.paper" }}
            />
            <Chip
              icon={<CheckCircle2 size={16} />}
              label={`${summary.fulfilled} Fulfilled`}
              color="success"
              sx={{ fontWeight: 800 }}
            />
            <Chip
              icon={<BadgeDollarSign size={16} />}
              label={formatCurrency(summary.amount, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              sx={{ fontWeight: 800, bgcolor: "background.paper" }}
            />
          </Stack>
        </Box>
      </Box>

      {feedback && (
        <Alert
          severity={feedback.type}
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      <Grid container spacing={3} className="section-rise-delay">
        <Grid
          size={{ xs: 12, lg: 6 }}
          sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <Card
            sx={{
              borderRadius: "8px",
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
              overflow: "hidden",
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}
              >
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: "primary.main",
                  }}
                >
                  <ClipboardList size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={900}>
                    New Order
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Customer, product, quantity, and billed amount.
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 3 }} />
              <form onSubmit={handlePlaceOrder}>
                <Box sx={{ mb: 3 }}>
                  <Autocomplete
                    options={products}
                    getOptionLabel={(option) => option.name}
                    value={selectedProduct}
                    onChange={(_, newValue) => {
                      setSelectedProduct(newValue);
                      setRate("");
                    }}
                    renderOption={(props, option) => (
                      <Box
                        component="li"
                        {...props}
                        sx={{ display: "flex", gap: 2 }}
                      >
                        <Avatar
                          variant="rounded"
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: "rgba(99, 102, 241, 0.1)",
                            color: "primary.main",
                          }}
                        >
                          {option.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {option.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.sku} - {option.stock} in stock
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search Product"
                        required
                        placeholder="Type product name or SKU..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search size={20} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={12}>
                    <Autocomplete
                      options={customerOptions}
                      value={selectedCustomer}
                      inputValue={customerName}
                      onChange={(_, newValue) => {
                        if (newValue && isCreateCustomerOption(newValue)) {
                          openNewCustomerDialog();
                          return;
                        }
                        setSelectedCustomer(newValue);
                        setCustomerName(newValue?.fullName || "");
                      }}
                      onInputChange={(_, newInputValue, reason) => {
                        setCustomerName(newInputValue);
                        if (reason === "input") setSelectedCustomer(null);
                      }}
                      getOptionLabel={(option) => option.fullName}
                      isOptionEqualToValue={(option, value) =>
                        option._id === value._id
                      }
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        const createOption = options.find(
                          isCreateCustomerOption,
                        );
                        const customerMatches = options.filter((option) => {
                          if (isCreateCustomerOption(option)) return false;
                          if (!query) return true;
                          return (
                            option.fullName.toLowerCase().includes(query) ||
                            option.phoneNumber.toLowerCase().includes(query) ||
                            option.customerType.toLowerCase().includes(query)
                          );
                        });
                        return createOption
                          ? [createOption, ...customerMatches]
                          : customerMatches;
                      }}
                      renderOption={(props, option) => (
                        <Box
                          component="li"
                          {...props}
                          sx={{
                            display: "flex",
                            gap: 1.5,
                            alignItems: "center",
                            borderBottom: isCreateCustomerOption(option)
                              ? "1px solid"
                              : "none",
                            borderColor: "divider",
                            py: isCreateCustomerOption(option)
                              ? 1.25
                              : undefined,
                          }}
                        >
                          {isCreateCustomerOption(option) ? (
                            <>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: alpha(
                                    theme.palette.primary.main,
                                    0.16,
                                  ),
                                  color: "primary.main",
                                }}
                              >
                                <UserRoundPlus size={17} />
                              </Avatar>
                              <Box>
                                <Typography
                                  variant="body2"
                                  fontWeight={900}
                                  color="primary.main"
                                >
                                  New Customer
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Create customer and select for this order
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: alpha(
                                    theme.palette.primary.main,
                                    0.12,
                                  ),
                                  color: "primary.main",
                                }}
                              >
                                <UserRound size={17} />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={700}>
                                  {option.fullName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {option.phoneNumber} - {option.customerType}
                                </Typography>
                              </Box>
                            </>
                          )}
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Customer"
                          placeholder="Optional: select existing customer"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <UserRound size={20} />
                                </InputAdornment>
                                {params.InputProps.startAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={12}>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1.5,
                        alignItems: { xs: "stretch", sm: "flex-start" },
                        flexDirection: { xs: "column", sm: "row" },
                      }}
                    >
                      <TextField
                        label="Order Quantity"
                        type="number"
                        required
                        value={Number(quantity) < 0 ? "0" : quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Package size={20} />
                            </InputAdornment>
                          ),
                        }}
                        helperText={
                          selectedProduct
                            ? `Available stock: ${selectedProduct.stock}`
                            : ""
                        }
                        sx={{ width: { xs: "100%", sm: 260 } }}
                      />
                      {selectedProduct && (
                        <Box
                          sx={{
                            width: { xs: "100%", sm: 220 },
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                            pt: { xs: 0, sm: 0.25 },
                          }}
                        >
                          <Chip
                            icon={<Package size={16} />}
                            label={selectedProductUnitLabel}
                            variant="outlined"
                            sx={{
                              justifyContent: "flex-start",
                              fontWeight: 900,
                              borderRadius: "8px",
                              width: "100%",
                              height: 40,
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Rate"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {currencySymbol}
                          </InputAdornment>
                        ),
                      }}
                      helperText="Price per selected unit"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Amount"
                      value={lineAmount}
                      disabled
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {currencySymbol}
                          </InputAdornment>
                        ),
                      }}
                      helperText={
                        selectedProduct
                          ? "Quantity x rate"
                          : "Select product to calculate"
                      }
                    />
                  </Grid>
                  <Grid size={12}>
                    <Button
                      type="button"
                      variant="outlined"
                      startIcon={<Package size={18} />}
                      onClick={handleAddLineItem}
                      disabled={!canAddCurrentLine}
                      sx={{ fontWeight: 900, borderRadius: "8px" }}
                    >
                      Add More
                    </Button>
                  </Grid>
                  {lineItems.length > 0 && (
                    <Grid size={12}>
                      <TableContainer
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 900 }}>
                                Product
                              </TableCell>
                              <TableCell sx={{ fontWeight: 900 }}>
                                Unit
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900 }}>
                                Qty
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900 }}>
                                Rate
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900 }}>
                                Amount
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900 }}>
                                Action
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {lineItems.map((line) => (
                              <TableRow key={line.lineId}>
                                <TableCell sx={{ fontWeight: 800 }}>
                                  {line.productName}
                                </TableCell>
                                <TableCell>
                                  {getProductUnitLabel(
                                    line.productUnitCode,
                                    line.productUnit,
                                    line.productUnitUrdu,
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  {line.quantity}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(line.rate, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                  {formatCurrency(line.amount, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell align="right">
                                  <Button
                                    type="button"
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveLineItem(line.lineId)}
                                    sx={{ fontWeight: 800 }}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 1,
                          mt: 1.25,
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Total Amount
                        </Typography>
                        <Chip
                          color="primary"
                          label={formatCurrency(currentOrderTotal, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                          sx={{ fontWeight: 900 }}
                        />
                      </Box>
                    </Grid>
                  )}
                  <Grid size={12}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={700}
                      sx={{ display: "block", mb: 1 }}
                    >
                      Payment Method
                    </Typography>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      useFlexGap
                    >
                      {paymentOptions.map((option) => {
                        const selected = paymentMethod === option.value;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={selected ? "contained" : "outlined"}
                            startIcon={option.icon}
                            disabled={!canSubmitOrder || transactionLoading}
                            onClick={() => handleStartPayment(option.value)}
                            sx={{
                              flex: 1,
                              borderRadius: "8px",
                              py: 1.15,
                              fontWeight: 900,
                              borderColor: selected
                                ? "primary.main"
                                : "divider",
                            }}
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </Stack>
                    {paymentMethod === "credit" && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        fontWeight={700}
                        sx={{ display: "block", mt: 1 }}
                      >
                        {formatCurrency(draftCreditTotalToReceive, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        will be the customer balance after this credit payment.
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Order Notes (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Box>

                <Box
                  sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
                >
                  {availabilityColor === "fulfilled" ? (
                    <CheckCircle2 size={18} color="#16a34a" />
                  ) : availabilityColor === "rejected" ? (
                    <XCircle size={18} color="#dc2626" />
                  ) : (
                    <ClipboardList size={18} color="#64748b" />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {availabilityLabel}
                  </Typography>
                  {availabilityColor !== "neutral" && (
                    <Chip
                      label={
                        availabilityColor === "fulfilled"
                          ? "In Stock"
                          : "Insufficient"
                      }
                      size="small"
                      color={
                        availabilityColor === "fulfilled" ? "success" : "error"
                      }
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  type="submit"
                  disabled={!canSubmitOrder}
                  sx={{
                    py: 1.6,
                    borderRadius: "8px",
                    fontWeight: 900,
                    boxShadow: `0 14px 28px ${alpha(theme.palette.primary.main, 0.24)}`,
                  }}
                >
                  {transactionLoading
                    ? "Placing Order..."
                    : enoughStock
                      ? "Place Order & Deduct Stock"
                      : "Log Rejected Order"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: "8px",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: `0 14px 36px ${alpha(theme.palette.common.black, 0.06)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Availability Snapshot
              </Typography>
              <Divider sx={{ mb: 3 }} />
              {!selectedProduct ? (
                <Box sx={{ color: "text.secondary" }}>
                  Select a product to see real-time availability and impact.
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar
                      variant="rounded"
                      src={resolveProductImage(selectedProduct)}
                      alt={selectedProduct.name}
                      imgProps={{
                        onError: (e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          if (target.src !== placeholderFallback) {
                            target.src = placeholderFallback;
                          }
                        },
                      }}
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: "primary.main",
                      }}
                    >
                      {selectedProduct.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700}>
                        {selectedProduct.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedProduct.sku}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Current Stock
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {availableStock} {selectedProductUnitLabel}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Requested Qty
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {requestedQty || 0}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Rate
                    </Typography>
                    <Typography variant="body2" fontWeight={800}>
                      {formatCurrency(numericRate, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Line Amount
                    </Typography>
                    <Typography variant="body2" fontWeight={800}>
                      {formatCurrency(Number(lineAmount || 0), {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Order Total
                    </Typography>
                    <Typography variant="body2" fontWeight={900}>
                      {formatCurrency(currentOrderTotal, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Remaining After Order
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      color={enoughStock ? "success.main" : "error.main"}
                    >
                      {selectedProduct && requestedQty <= availableStock
                        ? `${availableStock - requestedQty} ${selectedProductUnitLabel}`
                        : "N/A"}
                    </Typography>
                  </Box>
                  <Chip
                    label={enoughStock ? "Can Fulfill" : "Insufficient Stock"}
                    color={enoughStock ? "success" : "error"}
                    size="small"
                    sx={{ fontWeight: 700, alignSelf: "flex-start" }}
                  />
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card
            sx={{
              borderRadius: "8px",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
              overflow: "hidden",
              height: "100%",
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box
                sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="h6" fontWeight={800}>
                  Customer Previous Data
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select a customer to see their previous purchases and dues.
                </Typography>
              </Box>
              {!selectedCustomer ? (
                <Box
                  sx={{
                    minHeight: 280,
                    display: "grid",
                    placeItems: "center",
                    color: "text.secondary",
                    textAlign: "center",
                    px: 3,
                  }}
                >
                  <Box>
                    <UserRound size={34} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      No customer selected yet.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ p: 3 }}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{ mb: 2 }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: "primary.main",
                        fontWeight: 900,
                      }}
                    >
                      {selectedCustomer.fullName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={900}>
                        {selectedCustomer.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedCustomer.phoneNumber}
                      </Typography>
                    </Box>
                  </Stack>

                  <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Orders
                        </Typography>
                        <Typography fontWeight={900}>
                          {selectedCustomerPreviousSummary.orders}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.success.main, 0.08),
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Quantity
                        </Typography>
                        <Typography fontWeight={900}>
                          {selectedCustomerPreviousSummary.quantity}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          To Receive
                        </Typography>
                        <Typography fontWeight={900} color="warning.main">
                          {formatCurrency(selectedCustomerCreditBalance, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                    <Chip
                      label={`Total ${formatCurrency(selectedCustomerPreviousSummary.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      color="primary"
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      label={`Paid ${formatCurrency(selectedCustomerPreviousSummary.paid, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      color="success"
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      label={`Closing Credit ${formatCurrency(selectedCustomerClosingCredit, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                  </Stack>

                  {selectedCustomerRecentLines.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                      No previous purchases found for this customer.
                    </Box>
                  ) : (
                    <TableContainer
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "8px",
                        maxHeight: 360,
                      }}
                    >
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>Product</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900 }}>
                              Qty
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 900 }}>
                              Amount
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedCustomerRecentLines.map((line) => (
                            <TableRow key={`${line.orderId}-${line.lineId}`}>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(line.timestamp).toLocaleDateString(undefined, {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={800}>
                                  {line.productName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {paymentMethodLabels[line.paymentMethod]}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{line.quantity}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 900 }}>
                                {formatCurrency(line.amount, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card
            sx={{
              borderRadius: "8px",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
              overflow: "hidden",
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box
                sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="h6" fontWeight={800}>
                  Order List
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Every placed order is logged here for review and pitching.
                </Typography>
              </Box>
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  display: "flex",
                  gap: 1.5,
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Chip
                  label={`Total: ${summary.total}`}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`Amount: ${formatCurrency(summary.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`Fulfilled: ${summary.fulfilled}`}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`Rejected: ${summary.rejected}`}
                  size="small"
                  color="error"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label={`Pending: ${summary.pending}`}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <Box
                sx={{
                  p: 2.5,
                  display: "flex",
                  gap: 1.5,
                  alignItems: "center",
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <TextField
                  placeholder="Search order, customer, product, or requester..."
                  size="small"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={18} color="#64748b" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flexGrow: 1, minWidth: { xs: "100%", sm: 280 } }}
                />
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | OrderStatus)
                  }
                  sx={{ minWidth: { xs: "100%", sm: 150 } }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="fulfilled">Fulfilled</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  startIcon={<Download size={18} />}
                  onClick={exportOrdersToCSV}
                  disabled={filteredOrders.length === 0}
                  sx={{
                    borderColor: "divider",
                    whiteSpace: "nowrap",
                    ml: { xs: 0, sm: "auto" },
                  }}
                >
                  Export CSV
                </Button>
                <Button
                  variant="contained"
                  disabled={filteredOrders.length === 0}
                  startIcon={<FileDown size={18} />}
                  onClick={handleDownloadPDF}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Print PDF
                </Button>
              </Box>
              <TableContainer
                sx={{
                  borderRadius: 0,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
                id="orders-print-area"
              >
                <Table sx={{ minWidth: 1260 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>ORDER ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>QTY</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>AMOUNT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>REASON</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        REQUESTED BY
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>TIME</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ACTIONS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11}>
                          <Box
                            sx={{
                              py: 4,
                              textAlign: "center",
                              color: "text.secondary",
                            }}
                          >
                            No orders match your filters yet.
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order: Order) => (
                        <TableRow key={order.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              #{order.id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {order.customerName || ANONYMOUS_CUSTOMER_NAME}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {getLineProductLabel(
                                order.lineItems,
                                order.productName,
                              )}
                            </Typography>
                            {order.lineItems && order.lineItems.length > 1 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {order.lineItems.length} products in this order
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {order.quantity}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={800}>
                              {formatCurrency(order.orderAmount || 0, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                paymentMethodLabels[
                                  order.paymentMethod || "cash"
                                ]
                              }
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 800 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                order.status === "fulfilled"
                                  ? "Fulfilled"
                                  : order.status
                              }
                              size="small"
                              color={
                                order.status === "fulfilled"
                                  ? "success"
                                  : order.status === "rejected"
                                    ? "error"
                                    : "warning"
                              }
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {order.notes || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {order.requestedBy}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(order.timestamp).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ReceiptText size={16} />}
                              onClick={() => setInvoiceOrder(order)}
                              sx={{ fontWeight: 800, whiteSpace: "nowrap" }}
                            >
                              Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={creditPaymentOpen}
        onClose={() => setCreditPaymentOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Credit Payment</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              fullWidth
              required
              label="Customer"
              value={customerName}
              InputProps={{ readOnly: true }}
              helperText="Credit settlement uses the selected customer balance."
            />
            <TextField
              fullWidth
              type="number"
              label={`Cash Received (${currencySymbol})`}
              value={creditPaidInput}
              onChange={(e) => setCreditPaidInput(e.target.value)}
              inputProps={{ min: 0, max: maxCreditPayment, step: "0.01" }}
              helperText={`Maximum: ${formatCurrency(maxCreditPayment, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            />
            <Box
              sx={{
                p: 2,
                borderRadius: "8px",
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={0.75}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Order
                  </Typography>
                  <Typography variant="body2" fontWeight={900}>
                    {formatCurrency(currentOrderTotal, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Previous Credit
                  </Typography>
                  <Typography variant="body2" fontWeight={900} color="warning.main">
                    {formatCurrency(selectedCustomerCreditBalance, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Paid Against Current Order
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {formatCurrency(draftCreditPaidForOrder, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cut From Previous Credit
                  </Typography>
                  <Typography variant="body2" fontWeight={800} color="success.main">
                    {formatCurrency(draftCreditPreviousAdjustment, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                {draftCreditPreviousAdjustment > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(draftCreditClosingAdjustment, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    from closing credit,{" "}
                    {formatCurrency(draftCreditTransactionAdjustment, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    from older credit invoices.
                  </Typography>
                )}
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    New Current Due
                  </Typography>
                  <Typography variant="body2" fontWeight={900} color="warning.main">
                    {formatCurrency(draftCreditDue, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total To Receive After Payment
                  </Typography>
                  <Typography variant="body2" fontWeight={900} color="warning.main">
                    {formatCurrency(draftCreditTotalToReceive, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            variant="outlined"
            onClick={() => setCreditPaymentOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleContinueCreditPayment}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmPaymentOpen}
        onClose={() => {
          setConfirmPaymentOpen(false);
          setPendingPaymentMethod(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Payment</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Confirm this payment to finalize the order and update stock.
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: "8px",
              bgcolor: "action.hover",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Cashier: <strong>{user?.name || "Staff"}</strong>
            </Typography>
            <Typography variant="body2" fontWeight={800}>
              Method:{" "}
              {paymentMethodLabels[pendingPaymentMethod || paymentMethod]}
            </Typography>
            <Typography variant="body2" fontWeight={800}>
              Items: {orderLinesForSubmit.length} product
              {orderLinesForSubmit.length === 1 ? "" : "s"}
            </Typography>
            {pendingPaymentMethod === "credit" && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Customer: <strong>{customerName}</strong>
                </Typography>
                <Typography variant="body2" fontWeight={800}>
                  Cash Received:{" "}
                  {formatCurrency(creditPaidNow + creditPreviousAdjustment, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
                <Typography variant="body2">
                  Paid Against Current Order:{" "}
                  {formatCurrency(creditPaidNow, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
                {creditPreviousAdjustment > 0 && (
                  <Typography variant="body2" color="success.main" fontWeight={800}>
                    Previous Credit Cut:{" "}
                    {formatCurrency(creditPreviousAdjustment, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                )}
                <Typography variant="body2" fontWeight={900} color="warning.main">
                  Current Order Due:{" "}
                  {formatCurrency(creditDue, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
              </Box>
            )}
            <Typography
              variant="h6"
              fontWeight={900}
              color="primary.main"
              sx={{ mt: 1 }}
            >
              Total:{" "}
              {formatCurrency(currentOrderTotal, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmPaymentOpen(false);
              setPendingPaymentMethod(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmPayment}
            disabled={transactionLoading}
          >
            {transactionLoading ? "Placing..." : "Confirm Payment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(invoiceOrder)}
        onClose={() => setInvoiceOrder(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <ReceiptText size={22} /> Order Invoice
        </DialogTitle>
        <DialogContent dividers>
          {invoiceOrder && (
            <Stack spacing={2.5} id="invoice-print-area">
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Invoice No.
                  </Typography>
                  <Typography variant="h6" fontWeight={900}>
                    #{invoiceOrder.id}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                  <Typography variant="caption" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {new Date(invoiceOrder.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography fontWeight={900}>
                    {invoiceOrder.customerName || ANONYMOUS_CUSTOMER_NAME}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Cashier / Requested By
                  </Typography>
                  <Typography fontWeight={900}>
                    {invoiceOrder.requestedBy}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Payment Method
                  </Typography>
                  <Typography fontWeight={900}>
                    {paymentMethodLabels[invoiceOrder.paymentMethod || "cash"]}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography
                    fontWeight={900}
                    sx={{ textTransform: "capitalize" }}
                  >
                    {invoiceOrder.status}
                  </Typography>
                </Grid>
              </Grid>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 70px 100px 120px",
                    gap: 1,
                    p: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  }}
                >
                  <Typography variant="caption" fontWeight={900}>
                    Product
                  </Typography>
                  <Typography variant="caption" fontWeight={900}>
                    Unit
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={900}
                    textAlign="right"
                  >
                    Qty
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={900}
                    textAlign="right"
                  >
                    Rate
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={900}
                    textAlign="right"
                  >
                    Amount
                  </Typography>
                </Box>
                {(invoiceOrder.lineItems?.length
                  ? invoiceOrder.lineItems
                  : [
                      {
                        lineId: invoiceOrder.id,
                        productId: invoiceOrder.productId,
                        productName: invoiceOrder.productName,
                        quantity: invoiceOrder.quantity,
                        rate:
                          invoiceOrder.quantity > 0
                            ? Number(invoiceOrder.orderAmount || 0) /
                              invoiceOrder.quantity
                            : 0,
                        amount: Number(invoiceOrder.orderAmount || 0),
                      },
                    ]
                ).map((line) => (
                  <Box
                    key={line.lineId}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 70px 100px 120px",
                      gap: 1,
                      p: 1.5,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" fontWeight={800}>
                      {line.productName}
                    </Typography>
                    <Typography variant="body2">
                      {getProductUnitLabel(
                        line.productUnitCode,
                        line.productUnit,
                        line.productUnitUrdu,
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      textAlign="right"
                    >
                      {line.quantity}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      textAlign="right"
                    >
                      {formatCurrency(line.rate, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={900}
                      textAlign="right"
                    >
                      {formatCurrency(line.amount, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Stack spacing={1}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography color="text.secondary">Total</Typography>
                  <Typography fontWeight={900}>
                    {formatCurrency(invoiceOrder.orderAmount || 0, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography color="text.secondary">Paid Now</Typography>
                  <Typography fontWeight={800}>
                    {formatCurrency(invoiceOrder.paidNow || 0, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography color="text.secondary">
                    Amount To Receive
                  </Typography>
                  <Typography
                    fontWeight={900}
                    color={
                      (invoiceOrder.dueAmount || 0) > 0
                        ? "warning.main"
                        : "success.main"
                    }
                  >
                    {formatCurrency(invoiceOrder.dueAmount || 0, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              </Stack>

              {invoiceOrder.notes && (
                <Alert
                  severity={
                    invoiceOrder.status === "rejected" ? "error" : "info"
                  }
                >
                  {invoiceOrder.notes}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            variant="contained"
            startIcon={<FileDown size={18} />}
            onClick={handlePrintInvoice}
            sx={{ fontWeight: 800 }}
          >
            Print Invoice
          </Button>
          <Button
            variant="outlined"
            startIcon={<Share2 size={18} />}
            onClick={handleShareInvoice}
            sx={{ fontWeight: 800 }}
          >
            Share Invoice
          </Button>
          <Button color="inherit" onClick={() => setInvoiceOrder(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={customerDialogOpen}
        onClose={resetCustomerDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Create New Customer</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={customerForm.fullName}
                onChange={(e) =>
                  handleCustomerFormChange("fullName", e.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Phone Number"
                value={customerForm.phoneNumber}
                onChange={(e) =>
                  handleCustomerFormChange("phoneNumber", e.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Opening Amount"
                value={customerForm.amount}
                onChange={(e) =>
                  handleCustomerFormChange("amount", e.target.value)
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {currencySymbol}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Customer Type"
                value={customerForm.customerType}
                onChange={(e) =>
                  handleCustomerFormChange("customerType", e.target.value)
                }
              >
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="credit">Credit</MenuItem>
                <MenuItem value="installment">Installment</MenuItem>
                <MenuItem value="wholesale">Wholesale</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Email"
                value={customerForm.email}
                onChange={(e) =>
                  handleCustomerFormChange("email", e.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Province"
                value={customerForm.province}
                onChange={(e) => handleCustomerProvinceChange(e.target.value)}
              >
                <MenuItem value="">Select province</MenuItem>
                {pakistanProvinces.map((province) => (
                  <MenuItem key={province} value={province}>
                    {province}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="City"
                value={customerForm.city}
                disabled={!customerForm.province}
                onChange={(e) =>
                  handleCustomerFormChange("city", e.target.value)
                }
                helperText={
                  customerForm.province
                    ? "Cities filtered by selected province"
                    : "Select province first"
                }
              >
                <MenuItem value="">Select city</MenuItem>
                {customerCityOptions.map((city) => (
                  <MenuItem key={city} value={city}>
                    {city}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Address"
                value={customerForm.address}
                onChange={(e) =>
                  handleCustomerFormChange("address", e.target.value)
                }
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Notes"
                value={customerForm.notes}
                onChange={(e) =>
                  handleCustomerFormChange("notes", e.target.value)
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            color="inherit"
            onClick={resetCustomerDialog}
            disabled={customerSaving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateCustomer}
            disabled={customerSaving}
            sx={{ fontWeight: 800 }}
          >
            {customerSaving ? "Creating..." : "Create & Select"}
          </Button>
        </DialogActions>
      </Dialog>

      <style>
        {`
                @media print {
                    body * { visibility: hidden; }
                    ${printTarget === "invoice" ? "#invoice-print-area" : "#orders-print-area"},
                    ${printTarget === "invoice" ? "#invoice-print-area" : "#orders-print-area"} * {
                        visibility: visible;
                    }
                    ${printTarget === "invoice" ? "#invoice-print-area" : "#orders-print-area"} {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        color: black !important;
                        padding: 24px;
                    }
                    ${printTarget === "invoice" ? "#invoice-print-area" : "#orders-print-area"} * {
                        color: black !important;
                    }
                }
                `}
      </style>
    </Box>
  );
};

export default OrderDesk;
