
// components/OrderGrid.js
import React from 'react';
import { RefreshCw } from 'lucide-react';

const OrderGrid = ({
                       orders,
                       onRefresh,
                       orderFilterImmediate,
                       dateFilter,
                       statusFilter,
                       onOrderFilterChange,
                       onDateFilterChange,
                       onStatusFilterChange,
                       currentPage,
                       itemsPerPage,
                       Pagination,
                   }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Incoming Orders</h2>
                <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300"
                    title="Refresh orders"
                >
                    <RefreshCw size={16}/>
                    <span>Refresh</span>
                </button>
            </div>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <input
                    type="text"
                    placeholder="Filter by Order #"
                    value={orderFilterImmediate}
                    onChange={onOrderFilterChange}
                    className="p-2 border rounded"
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
                >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="used">Used</option>
                </select>
            </div>
            <div className="h-[440px] overflow-y-auto">
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Order Number</th>
                        <th className="border p-2">Created At</th>
                        <th className="border p-2">Status</th>
                    </tr>
                    </thead>
                    <tbody>
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

export default OrderGrid;