import React from 'react';
import { RefreshCw } from 'lucide-react';

const SyncAppUsersAndOrders = ({ onSync, isSyncing }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-semibold">Sync App Users & Orders</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Automatically match and activate pending app users with their purchase orders
                    </p>
                </div>
                <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300 disabled:bg-blue-300"
                >
                    <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
            </div>
        </div>
    );
};

export default SyncAppUsersAndOrders;