// src/components/AppPurchaseOrderGrid.js - Enhanced with new columns and filters
import React from 'react';

const AppPurchaseOrderGrid = ({
                                  orders,
                                  onRefresh,
                                  orderFilterImmediate,
                                  dateFilter,
                                  statusFilter,
                                  sourceFilter,
                                  appIdFilter,           // NEW
                                  customerNameFilter,    // NEW
                                  productNameFilter,     // NEW
                                  onOrderFilterChange,
                                  onDateFilterChange,
                                  onStatusFilterChange,
                                  onSourceFilterChange,
                                  onAppIdFilterChange,      // NEW
                                  onCustomerNameFilterChange, // NEW
                                  onProductNameFilterChange,  // NEW
                                  currentPage,
                                  itemsPerPage,
                                  isLoading,
                                  Pagination,
                                  availableApps = []     // NEW - for AppId dropdown options
                              }) => {
    // Helper function to format dates consistently
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (error) {
            return 'Invalid Date';
        }
    };

    // Helper function to format link type with better display
    const formatLinkType = (linkType) => {
        if (!linkType) return 'N/A';
        switch (linkType.toLowerCase()) {
            case 'email': return 'Email Registration';
            case 'unique': return 'Unique Link';
            case 'generic': return 'Generic Link';
            default: return linkType;
        }
    };

    // Helper function to format source with better display
    const formatSource = (source) => {
        if (!source) return 'N/A';
        switch (source.toLowerCase()) {
            case 'kajabi': return 'Kajabi';
            case 'whop': return 'Whop';
            case 'stan': return 'Stan';
            case 'manual': return 'Manual Entry';
            case 'native': return 'Native';
            default: return source;
        }
    };

    // Helper function to format AppId for display
    const formatAppId = (appId) => {
        if (!appId) return 'N/A';
        // Convert app-id format to readable
        return appId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Helper function to format currency amounts
    const formatAmount = (amount, currency = 'USD') => {
        if (!amount && amount !== 0) return 'N/A';
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (error) {
            return `$${amount}`;
        }
    };

    // Helper function to get status styling
    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'used':
                return 'bg-green-100 text-green-800';
            case 'active':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Get unique AppIds for dropdown
    const getUniqueAppIds = () => {
        if (availableApps.length > 0) {
            return availableApps.map(app => ({ id: app.AppId, name: app.AppName || app.AppId }));
        }
        // Fallback to extracting from orders
        const uniqueAppIds = [...new Set(orders.map(order => order.AppId).filter(Boolean))];
        return uniqueAppIds.map(appId => ({ id: appId, name: formatAppId(appId) }));
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Purchase Orders</h2>
                <button
                    onClick={onRefresh}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Enhanced Filter Controls - Now in 2 rows */}
            <div className="space-y-4 mb-6">
                {/* First Row - Original Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Filter by Order Number"
                        value={orderFilterImmediate}
                        onChange={onOrderFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    />
                    <div className="relative">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={onDateFilterChange}
                            className={`p-2 border rounded w-full ${!dateFilter ? 'text-transparent' : ''}`}
                            style={{
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                appearance: 'none',
                                minWidth: 'auto',
                                maxWidth: '100%'
                            }}
                            disabled={isLoading}
                            onFocus={(e) => e.target.showPicker()}
                        />
                        {!dateFilter && (
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                                Filter by Date
                            </span>
                        )}
                    </div>
                    <select
                        value={statusFilter}
                        onChange={onStatusFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="used">Used</option>
                        <option value="active">Active</option>
                    </select>
                    <select
                        value={sourceFilter}
                        onChange={onSourceFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    >
                        <option value="">All Sources</option>
                        <option value="native">Native</option>
                        <option value="kajabi">Kajabi</option>
                        <option value="whop">Whop</option>
                        <option value="stan">Stan</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>

                {/* Second Row - New Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select
                        value={appIdFilter}
                        onChange={onAppIdFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    >
                        <option value="">All Apps</option>
                        {getUniqueAppIds().map((app) => (
                            <option key={app.id} value={app.id}>
                                {app.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Filter by Customer Name"
                        value={customerNameFilter}
                        onChange={onCustomerNameFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    />
                    <input
                        type="text"
                        placeholder="Filter by Product Name"
                        value={productNameFilter}
                        onChange={onProductNameFilterChange}
                        className="p-2 border rounded"
                        disabled={isLoading}
                    />
                </div>
            </div>

            {/* Enhanced Table with All Fields */}
            <div className={`overflow-x-auto transition-all duration-200 ${
                orders.length === 0 ? 'h-[100px]' :
                    orders.length <= 5 ? 'h-[500px]' :
                        'h-[600px]'
            }`}>
                <table className="w-full border-collapse border min-w-[1600px]">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-3 text-left font-semibold">Order Number</th>
                        <th className="border p-3 text-left font-semibold">App</th>                    {/* NEW */}
                        <th className="border p-3 text-left font-semibold">Customer</th>               {/* NEW */}
                        <th className="border p-3 text-left font-semibold">Product</th>                {/* NEW */}
                        <th className="border p-3 text-left font-semibold">Amount</th>                 {/* NEW */}
                        <th className="border p-3 text-left font-semibold">Email</th>
                        <th className="border p-3 text-left font-semibold">Created At</th>
                        <th className="border p-3 text-left font-semibold">Status</th>
                        <th className="border p-3 text-left font-semibold">Link Type</th>
                        <th className="border p-3 text-left font-semibold">Source</th>
                        <th className="border p-3 text-left font-semibold">Token Created</th>
                        <th className="border p-3 text-left font-semibold">Registration Date</th>
                    </tr>
                    </thead>
                    <tbody className={isLoading ? 'opacity-50' : ''}>
                    {orders.length === 0 ? (
                        <tr>
                            <td colSpan="12" className="border p-4 text-center text-gray-500">
                                {isLoading ? 'Loading orders...' : 'No purchase orders found'}
                            </td>
                        </tr>
                    ) : (
                        orders
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map((order, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-gray-100'}>
                                    {/* Order Number */}
                                    <td className="border p-3 font-mono text-sm">
                                        {order.OrderNumber || 'N/A'}
                                    </td>

                                    {/* App - NEW COLUMN */}
                                    <td className="border p-3">
                                            <span className="text-sm font-medium" title={order.AppId}>
                                                {formatAppId(order.AppId)}
                                            </span>
                                    </td>

                                    {/* Customer Name - NEW COLUMN */}
                                    <td className="border p-3">
                                        {order.CustomerName ? (
                                            <span className="text-sm" title={order.CustomerName}>
                                                    {order.CustomerName.length > 20
                                                        ? `${order.CustomerName.substring(0, 20)}...`
                                                        : order.CustomerName}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>

                                    {/* Product Name - NEW COLUMN */}
                                    <td className="border p-3">
                                        {order.ProductName ? (
                                            <span className="text-sm" title={order.ProductName}>
                                                    {order.ProductName.length > 20
                                                        ? `${order.ProductName.substring(0, 20)}...`
                                                        : order.ProductName}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>

                                    {/* Amount - NEW COLUMN */}
                                    <td className="border p-3">
                                        {order.Amount !== undefined ? (
                                            <span className="text-sm font-medium text-green-600">
                                                    {formatAmount(order.Amount, order.Currency)}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>

                                    {/* Email */}
                                    <td className="border p-3">
                                        {order.Email ? (
                                            <span className="text-blue-600 text-sm" title={order.Email}>
                                                    {order.Email.length > 25
                                                        ? `${order.Email.substring(0, 25)}...`
                                                        : order.Email}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>

                                    {/* Created At */}
                                    <td className="border p-3 text-sm">
                                        {formatDate(order.CreatedAt)}
                                    </td>

                                    {/* Status with styling */}
                                    <td className="border p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(order.Status)}`}>
                                                {order.Status || 'Unknown'}
                                            </span>
                                    </td>

                                    {/* Link Type */}
                                    <td className="border p-3">
                                            <span className="text-sm">
                                                {formatLinkType(order.LinkType)}
                                            </span>
                                    </td>

                                    {/* Source */}
                                    <td className="border p-3">
                                            <span className="text-sm font-medium">
                                                {formatSource(order.Source)}
                                            </span>
                                    </td>

                                    {/* Token Created At */}
                                    <td className="border p-3 text-sm">
                                        {order.TokenCreatedAt ? (
                                            <span title={formatDate(order.TokenCreatedAt)}>
                                                    {formatDate(order.TokenCreatedAt)}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>

                                    {/* Registration Date */}
                                    <td className="border p-3 text-sm">
                                        {order.RegistrationDate ? (
                                            <span title={formatDate(order.RegistrationDate)}>
                                                    {formatDate(order.RegistrationDate)}
                                                </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {Pagination}

            {/* Orders count info */}
            <div className="mt-4 text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, orders.length)}-{Math.min(currentPage * itemsPerPage, orders.length)} of {orders.length} orders
            </div>
        </div>
    );
};

export default AppPurchaseOrderGrid;