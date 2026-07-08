import type { Product } from '../features/inventory/inventorySlice';
import type { Order } from '../features/orders/ordersSlice';
import type { Transaction } from '../features/transactions/transactionSlice';

export interface InstallmentNotificationScheduleItem {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: 'pending' | 'paid';
}

export interface InstallmentNotificationPlan {
    planCode: string;
    customerName: string;
    productName: string;
    status: 'active' | 'cleared';
    schedule: InstallmentNotificationScheduleItem[];
}

export interface NotificationItem {
    id: string;
    title: string;
    detail: string;
    time: string;
    path?: string;
    category: 'installment' | 'order' | 'stock' | 'transaction';
    severity: 'warning' | 'success' | 'info';
    sortTime: number;
}

interface BuildNotificationsOptions {
    installmentPlans: InstallmentNotificationPlan[];
    orders: Order[];
    transactions: Transaction[];
    products: Product[];
    orderUpdatesEnabled: boolean;
    lowStockAlertsEnabled: boolean;
    now?: Date;
}

export const buildInstallmentNotifications = (
    plans: InstallmentNotificationPlan[],
    now = new Date()
): NotificationItem[] =>
    plans
        .filter((plan) => plan.status === 'active')
        .reduce<NotificationItem[]>((items, plan) => {
            const nextPending = (plan.schedule || []).find((item) => item.status === 'pending');
            if (!nextPending) {
                return items;
            }

            const dueDate = new Date(nextPending.dueDate);
            if (dueDate > now) {
                return items;
            }

            const isDueToday = dueDate.toDateString() === now.toDateString();

            items.push({
                id: `installment-${plan.planCode}-${nextPending.installmentNumber}`,
                title: isDueToday ? 'Installment Due Today' : 'Overdue Installment',
                detail: `${plan.customerName} - ${nextPending.amount} due for ${plan.productName}`,
                time: `Due ${dueDate.toLocaleDateString()}`,
                path: '/installments',
                category: 'installment' as const,
                severity: 'warning' as const,
                sortTime: dueDate.getTime(),
            });

            return items;
        }, []);

export const buildNotifications = ({
    installmentPlans,
    orders,
    transactions,
    products,
    orderUpdatesEnabled,
    lowStockAlertsEnabled,
    now = new Date(),
}: BuildNotificationsOptions): NotificationItem[] => {
    const installmentNotifications = buildInstallmentNotifications(installmentPlans, now);

    const orderAndTransactionNotifications: NotificationItem[] = orderUpdatesEnabled
        ? [
            ...orders.map((order) => ({
                id: `order-${order.id}`,
                title: `Order ${order.status === 'fulfilled' ? 'fulfilled' : order.status === 'rejected' ? 'rejected' : 'pending'}`,
                detail: `${order.productName} - ${order.quantity} units`,
                time: new Date(order.timestamp).toLocaleString(),
                path: '/orders',
                category: 'order' as const,
                severity: order.status === 'rejected' ? 'warning' as const : 'success' as const,
                sortTime: new Date(order.timestamp).getTime(),
            })),
            ...transactions.map((tx) => ({
                id: `tx-${tx.id}`,
                title: tx.type === 'addition' ? 'Stock Added' : 'Stock Reduced',
                detail: `${tx.productName} - ${tx.amount} units`,
                time: new Date(tx.timestamp).toLocaleString(),
                path: '/transactions',
                category: 'transaction' as const,
                severity: 'info' as const,
                sortTime: new Date(tx.timestamp).getTime(),
            })),
        ]
        : [];

    const lowStockNotifications: NotificationItem[] = lowStockAlertsEnabled
        ? products
            .filter((product) => product.stock <= product.minStock)
            .map((product) => ({
                id: `low-stock-${product.id}`,
                title: product.stock === 0 ? 'Out of Stock' : 'Low Stock Alert',
                detail: `${product.name} - ${product.stock} left (min ${product.minStock})`,
                time: `Updated ${product.lastUpdated ? new Date(product.lastUpdated).toLocaleString() : 'recently'}`,
                path: '/inventory',
                category: 'stock' as const,
                severity: 'warning' as const,
                sortTime: product.lastUpdated ? new Date(product.lastUpdated).getTime() : now.getTime(),
            }))
        : [];

    return [...installmentNotifications, ...orderAndTransactionNotifications, ...lowStockNotifications]
        .sort((a, b) => b.sortTime - a.sortTime);
};
