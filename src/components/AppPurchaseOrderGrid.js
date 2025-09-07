import React from 'react';
import { RefreshCw } from 'lucide-react';

const AppPurchaseOrderGrid = ({
                                  orders,
                                  onRefresh,
                                  orderFilterImmediate,
                                  dateFilter,
                                  statusFilter,
                                  sourceFilter,
                                  onOrderFilterChange,
                                  onDateFilterChange,
                                  onStatusFilterChange,
                                  onSourceFilterChange,
                                  currentPage,
                                  itemsPerPage,
                                  Pagination,
                                  isLoading
                              }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold whitespace-nowrap">App Purchase Orders</h2>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300 disabled:bg-gray-300 whitespace-nowrap ml-2"
                    title="Refresh orders"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
                    <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <input
                    type="text"
                    placeholder="Filter by Order #"
                    value={orderFilterImmediate}
                    onChange={onOrderFilterChange}
                    className="p-2 border rounded"
                    disabled={isLoading}
                />
                <div className="w-full relative">
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={onDateFilterChange}
                        className={`p-2 border rounded w-full max-w-full ${!dateFilter ? 'text-transparent' : ''}`}
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
                        <span
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
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
            <div className={`overflow-y-auto transition-all duration-200 ${
                orders.length === 0 ? 'h-[100px]' :
                    orders.length <= 5 ? 'h-[300px]' :
                        'h-[440px]'
            }`}>
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Order Number</th>
                        <th className="border p-2">Created At</th>
                        <th className="border p-2">Status</th>
                    </tr>
                    </thead>
                    <tbody className={isLoading ? 'opacity-50' : ''}>
                    {orders
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((order, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                <td className="border p-2">{order.OrderNumber}</td>
                                <td className="border p-2">{new Date(order.CreatedAt).toLocaleString()}</td>
                                <td className="border p-2">{order.Status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {Pagination}
        </div>
    );
};

export default AppPurchaseOrderGrid;