import React from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  Eye,
  Package,
  Printer,
  Search,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import {
  fetchTransactions,
  type Transaction,
} from "../../features/transactions/transactionSlice";
import useAppCurrency from "../../hooks/useAppCurrency";
import api from "../../api/axios";

type CreditCustomer = {
  customerName: string;
  customerCnic: string;
  outstandingAmount: number;
};

type PurchaseLine = {
  id: string;
  productName: string;
  quantity: number;
  amount: number;
  receivedAmount: number;
  dueAmount: number;
  time: string;
  paymentMethod: string;
};

type DayRecord = {
  dateKey: string;
  dateLabel: string;
  totalQuantity: number;
  totalAmount: number;
  receivedAmount: number;
  amountToReceive: number;
  itemSummary: string;
  lines: PurchaseLine[];
};

type CustomerRecord = {
  key: string;
  name: string;
  cnic: string;
  totalQuantity: number;
  totalAmount: number;
  receivedAmount: number;
  amountToReceive: number;
  lastPurchaseAt: string;
  days: DayRecord[];
};

const normalize = (value: string) => value.trim().toLowerCase();
const customerKey = (name: string, cnic = "") =>
  `${normalize(name)}::${normalize(cnic)}`;

const formatDayLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const getPaymentLabel = (method?: string) => {
  if (method === "credit") return "Credit";
  if (method === "installment") return "EMI";
  if (method === "card") return "Card";
  return "Cash";
};

const ANONYMOUS_CUSTOMER_NAME = "Anonymous";

const resolveReceivedAmount = (tx: Transaction) => {
  if (tx.paymentMethod === "credit" || tx.paymentMethod === "installment") {
    return Number(tx.paidNow || 0);
  }
  return Number(tx.paidNow || tx.totalPrice || 0);
};

const resolveDueAmount = (tx: Transaction) => {
  if (tx.dueAmount != null) return Number(tx.dueAmount || 0);
  return Math.max(Number(tx.totalPrice || 0) - resolveReceivedAmount(tx), 0);
};

const buildItemSummary = (lines: PurchaseLine[]) => {
  const itemMap = lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.productName] = (acc[line.productName] || 0) + line.quantity;
    return acc;
  }, {});

  return Object.entries(itemMap)
    .map(([productName, quantity]) => `${quantity} ${productName}`)
    .join(", ");
};

const CustomerRecordsPage: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { formatCurrency } = useAppCurrency();
  const { transactions, loading } = useSelector(
    (state: RootState) => state.transactions,
  );
  const [creditCustomers, setCreditCustomers] = React.useState<
    CreditCustomer[]
  >([]);
  const [detailRecord, setDetailRecord] = React.useState<CustomerRecord | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [printingDayKey, setPrintingDayKey] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (printingDayKey) {
      window.print();
    }
  }, [printingDayKey]);

  React.useEffect(() => {
    const handleAfterPrint = () => setPrintingDayKey(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  React.useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);

  React.useEffect(() => {
    const loadCreditCustomers = async () => {
      try {
        const response = await api.get("/credits/customers");
        setCreditCustomers(response.data || []);
      } catch {
        setCreditCustomers([]);
      }
    };

    loadCreditCustomers();
  }, []);

  const creditOutstandingMap = React.useMemo(() => {
    return creditCustomers.reduce<Record<string, number>>((acc, customer) => {
      acc[customerKey(customer.customerName, customer.customerCnic)] = Number(
        customer.outstandingAmount || 0,
      );
      return acc;
    }, {});
  }, [creditCustomers]);

  const customerRecords = React.useMemo<CustomerRecord[]>(() => {
    const sales = transactions
      .filter((tx) => tx.type === "reduction")
      .filter((tx) => {
        if (!fromDate && !toDate) return true;
        const ts = new Date(tx.timestamp);
        if (fromDate && ts < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && ts > new Date(`${toDate}T23:59:59.999`)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

    const grouped = sales.reduce<
      Record<
        string,
        {
          name: string;
          cnic: string;
          transactions: Transaction[];
        }
      >
    >((acc, tx) => {
      const name = tx.customerName?.trim() || ANONYMOUS_CUSTOMER_NAME;
      const cnic = tx.customerCnic?.trim() || "";
      const key = customerKey(name, cnic);
      if (!acc[key]) {
        acc[key] = { name, cnic, transactions: [] };
      }
      acc[key].transactions.push(tx);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([key, group]) => {
        const dayMap = group.transactions.reduce<Record<string, DayRecord>>(
          (acc, tx) => {
            const dateKey = new Date(tx.timestamp).toISOString().split("T")[0];
            const receivedAmount = resolveReceivedAmount(tx);
            const dueAmount = resolveDueAmount(tx);
            const line: PurchaseLine = {
              id: tx.id,
              productName: tx.productName,
              quantity: Number(tx.amount || 0),
              amount: Number(tx.totalPrice || 0),
              receivedAmount,
              dueAmount,
              time: formatTime(tx.timestamp),
              paymentMethod: getPaymentLabel(tx.paymentMethod),
            };

            if (!acc[dateKey]) {
              acc[dateKey] = {
                dateKey,
                dateLabel: formatDayLabel(tx.timestamp),
                totalQuantity: 0,
                totalAmount: 0,
                receivedAmount: 0,
                amountToReceive: 0,
                itemSummary: "",
                lines: [],
              };
            }

            acc[dateKey].lines.push(line);
            acc[dateKey].totalQuantity += line.quantity;
            acc[dateKey].totalAmount += line.amount;
            acc[dateKey].receivedAmount += line.receivedAmount;
            acc[dateKey].amountToReceive += line.dueAmount;
            acc[dateKey].itemSummary = buildItemSummary(acc[dateKey].lines);
            return acc;
          },
          {},
        );

        const days = Object.values(dayMap).sort((a, b) =>
          b.dateKey.localeCompare(a.dateKey),
        );
        const totalAmount = group.transactions.reduce(
          (sum, tx) => sum + Number(tx.totalPrice || 0),
          0,
        );
        const transactionDueAmount = group.transactions.reduce(
          (sum, tx) => sum + resolveDueAmount(tx),
          0,
        );
        const creditOutstanding = creditOutstandingMap[key];
        const amountToReceive = creditOutstanding ?? transactionDueAmount;

        return {
          key,
          name: group.name,
          cnic: group.cnic,
          totalQuantity: group.transactions.reduce(
            (sum, tx) => sum + Number(tx.amount || 0),
            0,
          ),
          totalAmount,
          receivedAmount: Math.max(totalAmount - amountToReceive, 0),
          amountToReceive,
          lastPurchaseAt: group.transactions[0]?.timestamp || "",
          days,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastPurchaseAt).getTime() -
          new Date(a.lastPurchaseAt).getTime(),
      );
  }, [transactions, creditOutstandingMap, fromDate, toDate]);

  React.useEffect(() => {
    if (!loading && transactions.length === 0) {
      setError(
        "No sales transactions found yet. Customer records will appear after sales are made with a customer name.",
      );
    } else {
      setError("");
    }
  }, [loading, transactions.length]);

  const filteredRecords = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return customerRecords;
    return customerRecords.filter((record) => {
      const haystack = [
        record.name,
        record.cnic,
        record.lastPurchaseAt
          ? new Date(record.lastPurchaseAt).toLocaleDateString()
          : "",
        String(record.totalQuantity),
        String(record.totalAmount),
        String(record.receivedAmount),
        String(record.amountToReceive),
        record.days.map((day) => day.itemSummary).join(", "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [customerRecords, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintDay = (dateKey: string) => {
    setPrintingDayKey(dateKey);
  };

  const summary = React.useMemo(() => {
    return customerRecords.reduce(
      (acc, record) => {
        acc.customers += 1;
        acc.amount += record.totalAmount;
        acc.received += record.receivedAmount;
        acc.receive += record.amountToReceive;
        acc.quantity += record.totalQuantity;
        return acc;
      },
      { customers: 0, amount: 0, received: 0, receive: 0, quantity: 0 },
    );
  }, [customerRecords]);

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.18),
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
              Customer Records
            </Typography>
            <Typography variant="body2" color="text.secondary">
              One customer row with total quantity, total amount, received
              amount, and remaining balance.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              icon={<UserRound size={16} />}
              label={`${summary.customers} Customers`}
              sx={{ bgcolor: "background.paper", fontWeight: 800 }}
            />
            <Chip
              icon={<Package size={16} />}
              label={`${summary.quantity} Items Sold`}
              sx={{ bgcolor: "background.paper", fontWeight: 800 }}
            />
            <Chip
              icon={<BadgeDollarSign size={16} />}
              label={`Received: ${formatCurrency(summary.received, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              color="success"
              sx={{ fontWeight: 800 }}
            />
            <Chip
              icon={<WalletCards size={16} />}
              label={`To Receive: ${formatCurrency(summary.receive, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              color="warning"
              sx={{ fontWeight: 800 }}
            />
          </Stack>
        </Box>
      </Box>

      {error && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: "8px" }}>
          {error}
        </Alert>
      )}

      {!detailRecord && (
        <Card
          id="printable-customer-records"
          sx={{
            borderRadius: "8px",
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Box className="print-only" sx={{ display: "none", p: 2.5 }}>
              <Typography variant="h5" fontWeight={900}>
                Customer Records
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generated on {new Date().toLocaleString()}
              </Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Customers: {summary.customers}
                </Typography>
                <Typography variant="body2">
                  Total Qty: {summary.quantity}
                </Typography>
                <Typography variant="body2">
                  Total Amount:{" "}
                  {formatCurrency(summary.amount, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Typography>
                <Typography variant="body2">
                  Received:{" "}
                  {formatCurrency(summary.received, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Typography>
                <Typography variant="body2">
                  Remaining:{" "}
                  {formatCurrency(summary.receive, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Typography>
              </Stack>
            </Box>

            <Box
              className="no-print"
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
                size="small"
                placeholder="Search customer, date, qty, amount..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: { xs: "100%", sm: 300 } }}
              />
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
              {(fromDate || toDate) && (
                <Button
                  size="small"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  sx={{ fontWeight: 800 }}
                >
                  Clear Dates
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Printer size={18} />}
                onClick={handlePrint}
                sx={{ fontWeight: 800, ml: "auto" }}
              >
                Print
              </Button>
            </Box>

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 1060 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>CUSTOMER</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>
                      LAST PURCHASE
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>TOTAL QTY</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>TOTAL AMOUNT</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>RECEIVED</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>REMAINING</TableCell>
                    <TableCell
                      align="right"
                      className="no-print"
                      sx={{ fontWeight: 900 }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Box
                          sx={{
                            py: 5,
                            textAlign: "center",
                            color: "text.secondary",
                          }}
                        >
                          {loading
                            ? "Loading customer records..."
                            : "No customer records found."}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.key} hover>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <Avatar
                              sx={{
                                bgcolor: alpha(
                                  theme.palette.primary.main,
                                  0.16,
                                ),
                                color: "primary.main",
                                fontWeight: 900,
                              }}
                            >
                              {record.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography fontWeight={900}>
                                {record.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {record.days.length} buying day
                                {record.days.length === 1 ? "" : "s"}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {record.lastPurchaseAt
                            ? new Date(
                                record.lastPurchaseAt,
                              ).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>
                          {record.totalQuantity}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>
                          {formatCurrency(record.totalAmount, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 900, color: "success.main" }}
                        >
                          {formatCurrency(record.receivedAmount, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 900,
                            color:
                              record.amountToReceive > 0
                                ? "warning.main"
                                : "success.main",
                          }}
                        >
                          {formatCurrency(record.amountToReceive, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        <TableCell align="right" className="no-print">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Eye size={16} />}
                            onClick={() => setDetailRecord(record)}
                            sx={{ fontWeight: 800 }}
                          >
                            Detail
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
      )}

      {!detailRecord && (
        <style>
          {`
          .print-only { display: none; }
          @media print {
              body * { visibility: hidden; }
              #printable-customer-records, #printable-customer-records * { visibility: visible; }
              #printable-customer-records {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
              }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
          }
          `}
        </style>
      )}

      {detailRecord && (
        <Card
          id="printable-customer-detail"
          sx={{
            borderRadius: "8px",
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Box
              className="no-print"
              sx={{
                p: { xs: 2, md: 3 },
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
                flexWrap: "wrap",
                borderBottom: "1px solid",
                borderColor: "divider",
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.warning.main, 0.08)})`,
              }}
            >
              <Box>
                <Typography variant="h5" fontWeight={900}>
                  Customer Purchase Detail
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date-wise buying, received money, and remaining balance.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<ArrowLeft size={18} />}
                onClick={() => setDetailRecord(null)}
                sx={{ fontWeight: 800 }}
              >
                Back to Customers
              </Button>
            </Box>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {detailRecord && (
                <Stack spacing={2.5}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 2,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <Box
                      sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
                    >
                      <Avatar
                        sx={{
                          width: 52,
                          height: 52,
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          fontWeight: 900,
                        }}
                      >
                        {detailRecord.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="h5" fontWeight={900}>
                          {detailRecord.name}
                        </Typography>
                      </Box>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Chip
                        label={`Qty ${detailRecord.totalQuantity}`}
                        sx={{ fontWeight: 800 }}
                      />
                      <Chip
                        label={`Total ${formatCurrency(detailRecord.totalAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        color="primary"
                        sx={{ fontWeight: 800 }}
                      />
                      <Chip
                        label={`Received ${formatCurrency(detailRecord.receivedAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        color="success"
                        sx={{ fontWeight: 800 }}
                      />
                      <Chip
                        label={`Remaining ${formatCurrency(detailRecord.amountToReceive, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        color={
                          detailRecord.amountToReceive > 0
                            ? "warning"
                            : "success"
                        }
                        sx={{ fontWeight: 800 }}
                      />
                    </Stack>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.primary.main, 0.18),
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          TOTAL DAYS
                        </Typography>
                        <Typography variant="h5" fontWeight={900}>
                          {detailRecord.days.length}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.success.main, 0.18),
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          TOTAL QUANTITY
                        </Typography>
                        <Typography variant="h5" fontWeight={900}>
                          {detailRecord.totalQuantity}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.success.main, 0.18),
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          MONEY RECEIVED
                        </Typography>
                        <Typography variant="h5" fontWeight={900}>
                          {formatCurrency(detailRecord.receivedAmount, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: "8px",
                          bgcolor: alpha(theme.palette.warning.main, 0.1),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.warning.main, 0.18),
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                        >
                          REMAINING
                        </Typography>
                        <Typography variant="h5" fontWeight={900}>
                          {formatCurrency(detailRecord.amountToReceive, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {detailRecord.days.map((day) => (
                    <Box
                      key={day.dateKey}
                      data-daykey={day.dateKey}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 2,
                            flexWrap: "wrap",
                          }}
                        >
                          <Box>
                            <Typography
                              fontWeight={900}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <CalendarDays size={18} />
                              {day.dateLabel}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              On {day.dateLabel}, {detailRecord.name} bought{" "}
                              {day.itemSummary}.
                            </Typography>
                          </Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Chip
                              size="small"
                              label={`Qty ${day.totalQuantity}`}
                              sx={{ fontWeight: 800 }}
                            />
                            <Chip
                              size="small"
                              label={`Total ${formatCurrency(day.totalAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                              color="primary"
                              sx={{ fontWeight: 800 }}
                            />
                            <Chip
                              size="small"
                              label={`Received ${formatCurrency(day.receivedAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                              color="success"
                              sx={{ fontWeight: 800 }}
                            />
                            <Chip
                              size="small"
                              label={`Remaining ${formatCurrency(day.amountToReceive, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                              color={
                                day.amountToReceive > 0 ? "warning" : "success"
                              }
                              sx={{ fontWeight: 800 }}
                            />
                            <Button
                              size="small"
                              variant="outlined"
                              className="no-print"
                              startIcon={<Printer size={14} />}
                              onClick={() => handlePrintDay(day.dateKey)}
                              sx={{ fontWeight: 800 }}
                            >
                              Print
                            </Button>
                          </Stack>
                        </Box>
                      </Box>

                      <TableContainer sx={{ overflowX: "auto" }}>
                        <Table size="small" sx={{ minWidth: 860 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 800 }}>
                                TIME
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                PRODUCT
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                QTY
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                AMOUNT
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                RECEIVED
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                REMAINING
                              </TableCell>
                              <TableCell sx={{ fontWeight: 800 }}>
                                PAYMENT
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {day.lines.map((line) => (
                              <TableRow
                                key={`${line.id}-${line.productName}-${line.time}`}
                                hover
                              >
                                <TableCell>{line.time}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={800}>
                                    {line.productName}
                                  </Typography>
                                </TableCell>
                                <TableCell>{line.quantity}</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>
                                  {formatCurrency(line.amount, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontWeight: 800,
                                    color: "success.main",
                                  }}
                                >
                                  {formatCurrency(line.receivedAmount, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontWeight: 800,
                                    color:
                                      line.dueAmount > 0
                                        ? "warning.main"
                                        : "success.main",
                                  }}
                                >
                                  {formatCurrency(line.dueAmount, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={line.paymentMethod}
                                    variant="outlined"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {detailRecord && (
        <style>
          {`
          @media print {
              body * { visibility: hidden; }
              #printable-customer-detail, #printable-customer-detail * { visibility: visible; }
              #printable-customer-detail {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
              }
              .no-print { display: none !important; }
              ${printingDayKey ? `[data-daykey]:not([data-daykey="${printingDayKey}"]) { display: none !important; }` : ""}
          }
          `}
        </style>
      )}
    </Box>
  );
};

export default CustomerRecordsPage;
