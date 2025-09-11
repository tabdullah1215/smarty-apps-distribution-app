// MINIMAL FIX: PendingAppUsersGrid.js - Shows SubApp info without complex backend lookups
import React from 'react';
import { RefreshCw } from 'lucide-react';

// Simple helper to make SubAppIds more readable

const formatAppName = (appId) => {
    if (!appId) return 'Unknown App';

    // Mapping for AppIds to friendly names
    const appNameMap = {
        'logo-generator': 'Logo Generator',
        'budget-tracker': 'Budget Tracker',
        'habit-tracker': 'Habit Tracker',
        'paycheck-app': 'Paycheck App',
        'business-tools': 'Business Tools',
        'savings-app': 'Savings App'
    };

    return appNameMap[appId] ||
        appId.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
};
const formatSubAppName = (subAppId) => {
    if (!subAppId) return '';

    const subAppMap = {
        'prime': 'Premium',
        'basic': 'Basic',
        'premium': 'Premium',
        'standard': 'Standard',
        'pro': 'Pro',
        'free': 'Free',
        'trial': 'Trial',
        'paycheck': 'Paycheck',
        'business': 'Business',
        'custom': 'Custom',
        'savings': 'Savings',
        'journey': 'Journey',
        'all': 'All Access'
    };

    return subAppMap[subAppId] ||
        subAppId.charAt(0).toUpperCase() + subAppId.slice(1);
};

const PendingAppUsersGrid = ({
                                 appUsers,
                                 onAppUserClick,
                                 onRefresh,
                                 appFilterImmediate,        // CHANGED: back to appFilterImmediate
                                 emailFilterImmediate,
                                 orderFilterImmediate,
                                 statusFilter,
                                 linkTypeFilter,
                                 onAppFilterChange,         // CHANGED: back to onAppFilterChange
                                 onEmailFilterChange,
                                 onOrderFilterChange,
                                 onStatusFilterChange,
                                 onLinkTypeFilterChange,
                                 currentPage,
                                 itemsPerPage,
                                 Pagination,
                                 isLoading,
                                 availableApps, // PRESERVED: for backward compatibility
                                 onSyncThirdPartyOrder
                             }) => {

    // 3. UPDATE available apps logic (extract unique AppIds instead of SubAppIds):
    const availableAppsList = React.useMemo(() => {

        if (availableApps && Array.isArray(availableApps)) {
            const uniqueAppIds = [...new Set(availableApps.map(user => user.AppId).filter(Boolean))];
            return uniqueAppIds.map(appId => ({
                AppId: appId,
                AppName: formatAppName(appId)
            }));
        }

        if (!Array.isArray(appUsers)) return [];

        // Get unique AppIds from current data
        const uniqueAppIds = [...new Set(appUsers.map(user => user.AppId).filter(Boolean))];
        return uniqueAppIds.map(appId => ({
            AppId: appId,
            AppName: formatAppName(appId)
        }));
    }, [appUsers]);

    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold min-w-[120px]">App Users</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Showing {statusFilter === 'pending' ? 'pending' : 'all'} users by App
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
                    value={appFilterImmediate  || ''}
                    onChange={onAppFilterChange}
                    className="p-2 border rounded font-medium"
                >
                    <option value="">All Apps</option>
                    {availableAppsList.map(subApp => (
                        <option key={subApp.AppId} value={subApp.AppId}>
                            {subApp.AppName}
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
                    <option value="email">Email</option>
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
                        <th className="border p-2">App Name</th>
                        {/* CHANGED: from App Name */}
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Order #</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Link Type</th>
                        <th className="border p-2">Actions</th>
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
                                        {/* PRIMARY: Show AppId (main app name) */}
                                        <div className="font-medium">
                                            {formatAppName(user.AppId)}
                                        </div>
                                        {/* SECONDARY: Show SubAppId (plan/tier) */}
                                        {user.SubAppId && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {formatSubAppName(user.SubAppId)} Plan
                                            </div>
                                        )}
                                    </button>
                                    {/* TECHNICAL: Show IDs for reference */}
                                    <div className="text-xs text-gray-400 mt-1">
                                        {user.AppId}{user.SubAppId ? ` • ${user.SubAppId}` : ''}
                                    </div>
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
                                <td className="border p-2">
                                    {/* NEW: Sync button - only show for email + pending */}
                                    {user.LinkType === 'email' && user.Status === 'pending' ? (
                                        <button
                                            onClick={() => onSyncThirdPartyOrder(user)}
                                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                            title="Sync 3rd party order"
                                        >
                                            Sync 3rd Party Order
                                        </button>
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </td>
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
                        {appFilterImmediate && ` for SubApp: ${formatSubAppName(appFilterImmediate)}`}
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