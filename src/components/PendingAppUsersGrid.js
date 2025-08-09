// MINIMAL FIX: PendingAppUsersGrid.js - Shows SubApp info without complex backend lookups
import React from 'react';
import { RefreshCw } from 'lucide-react';

// Simple helper to make SubAppIds more readable
const formatSubAppName = (subAppId) => {
    if (!subAppId) return 'Unknown SubApp';

    // Simple mapping for common SubApp types
    const nameMap = {
        'paycheck': 'Paycheck Budget Tracker',
        'business': 'Business Budget Tracker',
        'custom': 'Custom Budget Tracker',
        'savings': 'Savings Goals',
        'premium': 'Logo Generator Premium',
        'basic': 'Basic Tracker App',
        'all': 'All Budget Trackers',
        'default': 'Default Tracker App',
        'journey': 'Habit Journeys'
    };

    return nameMap[subAppId] ||
        subAppId.charAt(0).toUpperCase() + subAppId.slice(1).replace(/[-_]/g, ' ');
};

const PendingAppUsersGrid = ({
                                 appUsers,
                                 onAppUserClick,
                                 onRefresh,
                                 subAppFilterImmediate, // CHANGED: from appFilterImmediate
                                 emailFilterImmediate,
                                 orderFilterImmediate,
                                 statusFilter,
                                 linkTypeFilter,
                                 onSubAppFilterChange, // CHANGED: from onAppFilterChange
                                 onEmailFilterChange,
                                 onOrderFilterChange,
                                 onStatusFilterChange,
                                 onLinkTypeFilterChange,
                                 currentPage,
                                 itemsPerPage,
                                 Pagination,
                                 isLoading,
                                 availableApps // PRESERVED: for backward compatibility
                             }) => {

    // NEW: Extract unique SubAppIds from current data for filter dropdown
    const availableSubApps = React.useMemo(() => {
        if (!Array.isArray(appUsers)) return [];

        const uniqueSubAppIds = [...new Set(appUsers.map(user => user.SubAppId).filter(Boolean))];
        return uniqueSubAppIds.map(subAppId => ({
            SubAppId: subAppId,
            SubAppName: formatSubAppName(subAppId)
        }));
    }, [appUsers]);

    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold min-w-[120px]">App Users</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Showing {statusFilter === 'pending' ? 'pending' : 'all'} users by SubApp
                    </p>
                </div>
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

            {/* ENHANCED: Filter section with SubApp focus */}
            <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* NEW: SubApp filter (replaces App filter) */}
                <select
                    value={subAppFilterImmediate || ''}
                    onChange={onSubAppFilterChange}
                    className="p-2 border rounded font-medium"
                >
                    <option value="">All Apps</option>
                    {availableSubApps.map(subApp => (
                        <option key={subApp.SubAppId} value={subApp.SubAppId}>
                            {subApp.SubAppName}
                        </option>
                    ))}
                </select>

                {/* ENHANCED: Email filter with clear button */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filter by Email"
                        value={emailFilterImmediate || ''}
                        onChange={onEmailFilterChange}
                        className="w-full p-2 pr-8 border rounded"
                    />
                    {emailFilterImmediate && (
                        <button
                            onClick={() => onEmailFilterChange({ target: { value: '' } })}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                            title="Clear email filter"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* ENHANCED: Order filter with clear button */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filter by Order #"
                        value={orderFilterImmediate || ''}
                        onChange={onOrderFilterChange}
                        className="w-full p-2 pr-8 border rounded"
                    />
                    {orderFilterImmediate && (
                        <button
                            onClick={() => onOrderFilterChange({ target: { value: '' } })}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                            title="Clear order filter"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <select
                    value={statusFilter || ''}
                    onChange={onStatusFilterChange}
                    className="p-2 border rounded font-medium"
                >
                    <option value="pending" className="font-medium">Pending Users</option>
                    <option value="">All Statuses</option>
                    <option value="active">Active Users</option>
                    <option value="inactive">Inactive Users</option>
                </select>

                <select
                    value={linkTypeFilter || ''}
                    onChange={onLinkTypeFilterChange}
                    className="p-2 border rounded"
                >
                    <option value="">All Link Types</option>
                    <option value="unique">Unique</option>
                    <option value="generic">Generic</option>
                </select>
            </div>

            {/* ENHANCED: Table with SubApp Name column */}
            <div className={`overflow-y-auto transition-all duration-200 ${
                (Array.isArray(appUsers) ? appUsers : []).length === 0 ? 'h-[100px]' :
                    (Array.isArray(appUsers) ? appUsers : []).length <= 5 ? 'h-[300px]' :
                        'h-[440px]'
            }`}>
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">App Name</th> {/* CHANGED: from App Name */}
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Order #</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Link Type</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(Array.isArray(appUsers) ? appUsers : [])
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((user, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                <td className="border p-2">
                                    <button
                                        onClick={() => onAppUserClick(user)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                    >
                                        {/* ENHANCED: Show formatted SubApp name */}
                                        {formatSubAppName(user.SubAppId)}
                                    </button>
                                    {/* NEW: Show SubAppId as subtitle for technical reference */}
                                    {user.SubAppId && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            ID: {user.SubAppId}
                                        </div>
                                    )}
                                </td>
                                <td className="border p-2">{user.Email}</td>
                                <td className="border p-2">{user.OrderNumber || 'N/A'}</td>
                                <td className="border p-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        user.Status === 'active' ? 'bg-green-100 text-green-800' :
                                            user.Status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                    }`}>
                                        {user.Status}
                                    </span>
                                </td>
                                <td className="border p-2">{user.LinkType}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* ENHANCED: Empty state with SubApp context */}
                {(Array.isArray(appUsers) ? appUsers : []).length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                        No app users found
                        {statusFilter && ` with status: ${statusFilter}`}
                        {linkTypeFilter && ` and link type: ${linkTypeFilter}`}
                        {subAppFilterImmediate && ` for SubApp: ${formatSubAppName(subAppFilterImmediate)}`}
                        {emailFilterImmediate && ` matching email: ${emailFilterImmediate}`}
                        {orderFilterImmediate && ` with order: ${orderFilterImmediate}`}
                    </div>
                )}
            </div>
            {Pagination}
        </div>
    );
};

export default PendingAppUsersGrid;