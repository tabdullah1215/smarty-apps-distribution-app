
import React, { useEffect } from 'react';

const Pagination = ({ currentPage, setCurrentPage, totalItems, itemsPerPage = 10 }) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    useEffect(() => {
        if (currentPage !== validCurrentPage && totalItems > 0) {
            setCurrentPage(validCurrentPage);
        }
    }, [currentPage, validCurrentPage, setCurrentPage, totalItems]);

    if (totalItems === 0) {
        return <div className="flex justify-center items-center mt-4">No items to display</div>;
    }

    return (
        <div className="flex justify-between items-center mt-4">
            <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={validCurrentPage === 1}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
                Previous
            </button>
            <span>{validCurrentPage} of {totalPages}</span>
            <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={validCurrentPage === totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;