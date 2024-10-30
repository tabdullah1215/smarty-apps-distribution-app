
// components/DistributorGrid.js
import React from 'react';
import { RefreshCw } from 'lucide-react';

const DistributorGrid = ({
                             distributors,
                             onDistributorClick,
                             onRefresh,
                             nameFilterImmediate,
                             emailFilterImmediate,
                             orderFilterImmediate,
                             statusFilter,
                             linkTypeFilter,
                             onNameFilterChange,
                             onEmailFilterChange,
                             onOrderFilterChange,
                             onStatusFilterChange,
                             onLinkTypeFilterChange,
                             currentPage,
                             itemsPerPage,
                             Pagination,
                         }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Distributors</h2>
                <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300"
                    title="Refresh distributors"
                >
                    <RefreshCw size={16}/>
                    <span>Refresh</span>
                </button>
            </div>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                <input
                    type="text"
                    placeholder="Filter by Name"
                    value={nameFilterImmediate}
                    onChange={onNameFilterChange}
                    className="p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Filter by Email"
                    value={emailFilterImmediate}
                    onChange={onEmailFilterChange}
                    className="p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Filter by Order #"
                    value={orderFilterImmediate}
                    onChange={onOrderFilterChange}
                    className="p-2 border rounded"
                />
                <select
                    value={statusFilter}
                    onChange={onStatusFilterChange}
                    className="p-2 border rounded"
                >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <select
                    value={linkTypeFilter}
                    onChange={onLinkTypeFilterChange}
                    className="p-2 border rounded"
                >
                    <option value="">All Link Types</option>
                    <option value="unique">Unique</option>
                    <option value="generic">Generic</option>
                </select>
            </div>
            <div className="h-[440px] overflow-y-auto">
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Name</th>
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Order #</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Link Type</th>
                    </tr>
                    </thead>
                    <tbody>
                    {distributors
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((distributor, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                <td className="border p-2">
                                    <button
                                        onClick={() => onDistributorClick(distributor)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                    >
                                        {distributor.DistributorName}
                                    </button>
                                </td>
                                <td className="border p-2">{distributor.Email || 'N/A'}</td>
                                <td className="border p-2">{distributor.OrderNumber || 'N/A'}</td>
                                <td className="border p-2">{distributor.Status}</td>
                                <td className="border p-2">{distributor.LinkType}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {Pagination}
        </div>
    );
};

export default DistributorGrid;