// components/SyncOrdersAndDistributors.js
import React from 'react';
import { RefreshCw } from 'lucide-react';

const SyncOrdersAndDistributors = ({ onSync, isSyncing }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Sync Orders and Distributors</h2>
                <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-300 disabled:bg-blue-300"
                >
                    <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
            </div>
        </div>
    );
};

export default SyncOrdersAndDistributors;