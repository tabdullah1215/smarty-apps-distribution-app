import React from 'react';
import { RefreshCw } from 'lucide-react';

const BulkAppPurchaseOrders = ({
                                   csvFile,
                                   onCsvUpload,
                                   onProcessCsv,
                                   isUploading,
                                   fileInputRef
                               }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Bulk Upload App Purchase Orders</h2>
            </div>
            <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={onCsvUpload}
                        className="p-2 border rounded"
                        disabled={isUploading}
                    />
                    <p className="text-sm text-gray-600">
                        Upload a CSV file containing order numbers. File should have a single column with order numbers.
                    </p>
                </div>
                <button
                    onClick={onProcessCsv}
                    disabled={!csvFile || isUploading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded
                             hover:bg-green-600 transition duration-300 disabled:bg-green-300 w-full md:w-fit"
                >
                    {isUploading ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Uploading...</span>
                        </>
                    ) : (
                        <span>Upload CSV</span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BulkAppPurchaseOrders;