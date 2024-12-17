import React from 'react';
import { RefreshCw } from 'lucide-react';

const PendingAppUsersGrid = ({
                                 appUsers,
                                 onAppUserClick,
                                 onRefresh,
                                 appFilterImmediate,
                                 emailFilterImmediate,
                                 orderFilterImmediate,
                                 statusFilter,
                                 linkTypeFilter,
                                 onAppFilterChange,
                                 onEmailFilterChange,
                                 onOrderFilterChange,
                                 onStatusFilterChange,
                                 onLinkTypeFilterChange,
                                 currentPage,
                                 itemsPerPage,
                                 Pagination,
                                 isLoading,
                                 availableApps
                             }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold min-w-[120px]">App Users</h2>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300 disabled:bg-gray-300 whitespace-nowrap"
                    title="Refresh app users"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
                    <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                <select
                    value={appFilterImmediate}
                    onChange={onAppFilterChange}
                    className="p-2 border rounded"
                >
                    <option value="">All Apps</option>
                    {availableApps.map(app => (
                        <option key={app.AppId} value={app.AppId}>
                            {app.Name}
                        </option>
                    ))}
                </select>
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
                        <th className="border p-2">App Name</th>
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Order #</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Link Type</th>
                    </tr>
                    </thead>
                    <tbody>
                    {appUsers
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((user, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                <td className="border p-2">
                                    <button
                                        onClick={() => onAppUserClick(user)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                    >
                                        {availableApps.find(app => app.AppId === user.AppId)?.Name || 'Unknown App'}
                                    </button>
                                </td>
                                <td className="border p-2">{user.Email}</td>
                                <td className="border p-2">{user.OrderNumber || 'N/A'}</td>
                                <td className="border p-2">{user.Status}</td>
                                <td className="border p-2">{user.LinkType}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {Pagination}
        </div>
    );
};

export default PendingAppUsersGrid;