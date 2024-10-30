
import React from 'react';

const SyncOrdersAndDistributors = ({ onSync }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Sync Orders and Distributors</h2>
            <button
                onClick={onSync}
                className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
            >
                Sync Now
            </button>
        </div>
    );
};

export default SyncOrdersAndDistributors;