import React, { useRef } from 'react';

const InsertOrder = ({
                         orderNumber,
                         onOrderNumberChange,
                         onSubmit,
                         isShowBulkUpload = true,
                         csvFile,
                         onCsvUpload,
                         onProcessCsv
                     }) => {
    const fileInputRef = useRef(null);

    return (
        <>
            <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Insert Order Number</h2>
                <form onSubmit={onSubmit}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                    <input
                        type="text"
                        value={orderNumber}
                        onChange={onOrderNumberChange}
                        placeholder="Enter order number"
                        className="flex-grow p-2 border rounded sm:rounded-r-none"
                        required
                    />
                    <button type="submit"
                            className="w-full md:w-fit py-2 px-4 bg-blue-500 text-white rounded sm:rounded-l-none">
                        Insert
                    </button>
                </form>
            </div>

            {isShowBulkUpload && (
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Bulk Upload Incoming Orders</h2>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={onCsvUpload}
                        className="mb-4"
                    />
                    <button
                        onClick={onProcessCsv}
                        className="w-full md:w-fit py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                    >
                        Upload CSV
                    </button>
                </div>
            )}
        </>
    );
};

export default InsertOrder;