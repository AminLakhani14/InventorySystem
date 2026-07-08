import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Edit3, Plus, Search, Trash2, UserRoundPlus } from "lucide-react";
import type { AxiosError } from "axios";
import api from "../../api/axios";
import useAppCurrency from "../../hooks/useAppCurrency";
import {
  getCitiesForProvince,
  pakistanProvinces,
} from "../../lib/pakistanLocations";
import { createHiddenCustomerId } from "../../lib/customerIdentity";

type CustomerType = "regular" | "credit" | "installment" | "wholesale";
type CustomerStatus = "active" | "inactive";

interface Customer {
  _id: string;
  fullName: string;
  cnic?: string;
  phoneNumber: string;
  amount: number;
  email: string;
  address: string;
  province: string;
  city: string;
  customerType: CustomerType;
  status: CustomerStatus;
  notes: string;
  updatedAt: string;
}

type CustomerFormState = Omit<Customer, "_id" | "updatedAt" | "cnic">;

const initialFormState: CustomerFormState = {
  fullName: "",
  phoneNumber: "",
  amount: 0,
  email: "",
  address: "",
  province: "",
  city: "",
  customerType: "regular",
  status: "active",
  notes: "",
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: "Regular",
  credit: "Credit",
  installment: "Installment",
  wholesale: "Wholesale",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{
    message?: string;
    details?: string;
  }>;
  const data = axiosError.response?.data;
  return data?.details || data?.message || fallback;
};

const CustomersPage: React.FC = () => {
  const { formatCurrency, currencySymbol } = useAppCurrency();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [form, setForm] = React.useState<CustomerFormState>(initialFormState);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const loadCustomers = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/customers");
      setCustomers(response.data || []);
    } catch (fetchError: unknown) {
      setError(getErrorMessage(fetchError, "Unable to load customers."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const cityOptions = React.useMemo(
    () => (form.province ? getCitiesForProvince(form.province) : []),
    [form.province],
  );

  const filteredCustomers = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter(
      (customer) =>
        customer.fullName.toLowerCase().includes(query) ||
        customer.phoneNumber.toLowerCase().includes(query) ||
        (customer.province || "").toLowerCase().includes(query) ||
        (customer.city || "").toLowerCase().includes(query) ||
        customer.customerType.toLowerCase().includes(query),
    );
  }, [customers, searchTerm]);

  const totals = React.useMemo(() => {
    return filteredCustomers.reduce(
      (acc, customer) => {
        acc.amount += Number(customer.amount || 0);
        acc.active += customer.status === "active" ? 1 : 0;
        acc.credit +=
          customer.customerType === "credit" ||
          customer.customerType === "installment"
            ? 1
            : 0;
        return acc;
      },
      { amount: 0, active: 0, credit: 0 },
    );
  }, [filteredCustomers]);

  const resetForm = () => {
    setForm(initialFormState);
    setEditingCustomer(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      fullName: customer.fullName,
      phoneNumber: customer.phoneNumber,
      amount: Number(customer.amount || 0),
      email: customer.email || "",
      address: customer.address || "",
      province: customer.province || "",
      city: customer.city || "",
      customerType: customer.customerType,
      status: customer.status,
      notes: customer.notes || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleChange = (
    field: keyof CustomerFormState,
    value: string | number,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleProvinceChange = (province: string) => {
    setForm((current) => ({ ...current, province, city: "" }));
  };

  const validateForm = () => {
    if (!form.fullName.trim()) return "Customer full name is required.";
    if (!form.phoneNumber.trim()) return "Phone number is required.";
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0)
      return "Closing amount cannot be negative.";
    return "";
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      cnic: editingCustomer?.cnic || createHiddenCustomerId(),
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      amount: Number(form.amount || 0),
      email: form.email.trim(),
      address: form.address.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      notes: form.notes.trim(),
    };

    try {
      const response = editingCustomer
        ? await api.patch(`/customers/${editingCustomer._id}`, payload)
        : await api.post("/customers", payload);

      setCustomers((current) =>
        editingCustomer
          ? current.map((customer) =>
              customer._id === editingCustomer._id ? response.data : customer,
            )
          : [response.data, ...current],
      );
      setSuccessMessage(
        editingCustomer ? "Customer updated." : "Customer created.",
      );
      handleCloseDialog();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Unable to save customer."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    try {
      await api.delete(`/customers/${deleteTarget._id}`);
      setCustomers((current) =>
        current.filter((customer) => customer._id !== deleteTarget._id),
      );
      setSuccessMessage("Customer deleted.");
      setDeleteTarget(null);
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Unable to delete customer."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          alignItems: { xs: "stretch", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Customers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and maintain customer records for sales, credit, and
            installments.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserRoundPlus size={18} />}
          onClick={handleOpenCreate}
          sx={{
            alignSelf: { xs: "stretch", sm: "center" },
            fontWeight: 800,
            borderRadius: "8px",
          }}
        >
          Create Customer
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: "8px" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Customers
              </Typography>
              <Typography variant="h4" fontWeight={900}>
                {filteredCustomers.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: "8px" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Active Customers
              </Typography>
              <Typography variant="h4" fontWeight={900} color="success.main">
                {totals.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: "8px" }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Amount
              </Typography>
              <Typography variant="h4" fontWeight={900} color="primary.main">
                {formatCurrency(totals.amount, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: "8px", overflow: "hidden" }}>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <TextField
              fullWidth
              placeholder="Search by name, phone, province, city, or type..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>CUSTOMER</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>PHONE</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>TYPE</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>AMOUNT</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>STATUS</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>PROVINCE</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>CITY</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">
                        {loading
                          ? "Loading customers..."
                          : "No customers found."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer._id} hover>
                      <TableCell>
                        <Typography fontWeight={800}>
                          {customer.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {customer.email || "No email"}
                        </Typography>
                      </TableCell>
                      <TableCell>{customer.phoneNumber}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={customerTypeLabels[customer.customerType]}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>
                        {formatCurrency(customer.amount, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            customer.status === "active" ? "success" : "default"
                          }
                          label={
                            customer.status === "active" ? "Active" : "Inactive"
                          }
                        />
                      </TableCell>
                      <TableCell>{customer.province || "-"}</TableCell>
                      <TableCell>{customer.city || "-"}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit customer">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenEdit(customer)}
                          >
                            <Edit3 size={17} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete customer">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(customer)}
                          >
                            <Trash2 size={17} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingCustomer ? "Edit Customer" : "Create Customer"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Full Name"
                value={form.fullName}
                onChange={(event) =>
                  handleChange("fullName", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Phone Number"
                value={form.phoneNumber}
                onChange={(event) =>
                  handleChange("phoneNumber", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                required
                label="Closing Amount"
                value={form.amount}
                onChange={(event) =>
                  handleChange("amount", Number(event.target.value))
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
                fullWidth
                label="Email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Province"
                value={form.province}
                onChange={(event) => handleProvinceChange(event.target.value)}
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
                value={form.city}
                disabled={!form.province}
                onChange={(event) => handleChange("city", event.target.value)}
                helperText={
                  form.province
                    ? "Cities filtered by selected province"
                    : "Select province first"
                }
              >
                <MenuItem value="">Select city</MenuItem>
                {cityOptions.map((city) => (
                  <MenuItem key={city} value={city}>
                    {city}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Customer Type"
                value={form.customerType}
                onChange={(event) =>
                  handleChange(
                    "customerType",
                    event.target.value as CustomerType,
                  )
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
                select
                fullWidth
                label="Status"
                value={form.status}
                onChange={(event) =>
                  handleChange("status", event.target.value as CustomerStatus)
                }
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Address"
                value={form.address}
                onChange={(event) =>
                  handleChange("address", event.target.value)
                }
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={form.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            variant="outlined"
            onClick={handleCloseDialog}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingCustomer
                ? "Save Changes"
                : "Create Customer"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Customer</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Delete {deleteTarget?.fullName}? This customer record will be
            removed from the customer list.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteTarget(null)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Trash2 size={18} />}
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={2500}
        onClose={() => setSuccessMessage("")}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccessMessage("")}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CustomersPage;
