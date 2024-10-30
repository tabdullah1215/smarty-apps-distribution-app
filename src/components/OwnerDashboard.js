import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import LinkGenerator from './LinkGenerator';  // Adjust the path as needed
import { useGenerateLink } from '../hooks/useGenerateLink';
import DistributorEditModal from './DistributorEditModal';  // Adjust path as needed
import { useDistributorUpdate } from '../hooks/useDistributorUpdate';
import DistributorGrid from './DistributorGrid';
import OrderGrid from './OrderGrid';

const useDebounce = (callback, delay) => {
    const timeoutRef = React.useRef(null);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const debouncedCallback = React.useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);

    return debouncedCallback;
};

export default function OwnerDashboard() {

    const [orderNumber, setOrderNumber] = useState('');
    const [pendingDistributors, setPendingDistributors] = useState([]);
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [nameFilter, setNameFilter] = useState('');
    const [orderFilter, setOrderFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [linkTypeFilter, setLinkTypeFilter] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });
    const [incomingOrderFilter, setIncomingOrderFilter] = useState('');
    const [incomingDateFilter, setIncomingDateFilter] = useState('');
    const [incomingStatusFilter, setIncomingStatusFilter] = useState('');
    const [distributorsPage, setDistributorsPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [emailFilter, setEmailFilter] = useState('');
    const [selectedDistributor, setSelectedDistributor] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const [nameFilterImmediate, setNameFilterImmediate] = useState('');
    const [emailFilterImmediate, setEmailFilterImmediate] = useState('');
    const [orderFilterImmediate, setOrderFilterImmediate] = useState('');
    const [incomingOrderFilterImmediate, setIncomingOrderFilterImmediate] = useState('');

    const setNameFilterDebounced = useDebounce((value) => setNameFilter(value), 500);
    const setEmailFilterDebounced = useDebounce((value) => setEmailFilter(value), 500);
    const setOrderFilterDebounced = useDebounce((value) => setOrderFilter(value), 500);
    const setIncomingOrderFilterDebounced = useDebounce((value) => setIncomingOrderFilter(value), 500);
    const itemsPerPage = 10;

    useEffect(() => {
        const totalPages = Math.ceil(pendingDistributors.length / itemsPerPage);
        if (distributorsPage > totalPages && totalPages > 0) {
            setDistributorsPage(totalPages);
        }
    }, [pendingDistributors, distributorsPage]);

    useEffect(() => {
        const totalPages = Math.ceil(incomingOrders.length / itemsPerPage);
        if (ordersPage > totalPages && totalPages > 0) {
            setOrdersPage(totalPages);
        }
    }, [incomingOrders, ordersPage]);

    const {
        uniqueLink,
        genericLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generateLink,
        copyToClipboard
    } = useGenerateLink(setPermanentMessage);

    const { handleDistributorUpdate, isUpdating } = useDistributorUpdate(
        // onSuccess callback
        (message, updatedData) => {
            setPermanentMessage({ type: 'success', content: message });
            if (updatedData.status) {
                setStatusFilter(updatedData.status);
            }
            fetchPendingDistributors();
            setShowEditModal(false);
        },
        // onError callback
        (errorMessage) => {
            setPermanentMessage({ type: 'error', content: errorMessage });
            setShowEditModal(false);
            setSelectedDistributor(null);
        }
    );

    const insertOrderNumber = async (e) => {
        e.preventDefault();
        const url = `${API_ENDPOINT}/insert-order`;
        console.log('Calling API at:', url);
        try {
            setPermanentMessage({ type: '', content: '' });

            const response = await axios.post(url,
                { orderNumber },
                {
                    params: { action: 'insertOrder' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            console.log('Order insertion response:', response.data);

            if (response.data && response.data.message) {
                setPermanentMessage({ type: 'success', content: `${response.data.message} - Order number: ${orderNumber}` });
                setOrderNumber('');
                fetchIncomingOrders();
            } else {
                setPermanentMessage({ type: 'error', content: 'Unexpected response from server. Please try again.' });
            }
        } catch (error) {
            console.error('Error inserting order number:', error);
            setPermanentMessage({ type: 'error', content: error.response?.data?.message || 'Failed to insert order number. Please try again.' });
        }
    };

    const syncOrdersAndDistributors = async () => {
        try {
            setPermanentMessage({ type: '', content: '' });
            const response = await axios.post(`${API_ENDPOINT}/create-distributor`,
                {},
                {
                    params: { action: 'syncOrdersAndDistributors' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            setPermanentMessage({ type: 'success', content: response.data.message });
            fetchPendingDistributors();
            fetchIncomingOrders();
        } catch (error) {
            console.error('Error syncing orders and distributors:', error);
            setPermanentMessage({ type: 'error', content: 'Failed to sync orders and distributors. Please try again.' });
        }
    };

    const fetchPendingDistributors = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINT}/get-distributors`, {
                params: {
                    action: 'getDistributors',
                    nameFilter,
                    emailFilter,
                    orderFilter,
                    statusFilter,
                    linkTypeFilter
                }
            });
            setPendingDistributors(response.data);
        } catch (error) {
            console.error('Error fetching pending distributors:', error);
            setPermanentMessage({ type: 'error', content: 'Failed to fetch pending distributors. Please try again.' });
        }
    };

    const fetchIncomingOrders = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINT}/get-incoming-orders`, {
                params: {
                    action: 'getIncomingOrders',
                    orderFilter: incomingOrderFilter,
                    dateFilter: incomingDateFilter,
                    statusFilter: incomingStatusFilter
                }
            });
            setIncomingOrders(response.data);
        } catch (error) {
            console.error('Error fetching incoming orders:', error);
            setPermanentMessage({ type: 'error', content: 'Failed to fetch incoming orders. Please try again.' });
        }
    };

    const handleCSVUpload = (event) => {
        const file = event.target.files[0];
        setCsvFile(file);
    };

    const processAndUploadCSV = async () => {
        if (!csvFile) {
            setPermanentMessage({ type: 'error', content: 'Please select a CSV file first.' });
            return;
        }

        Papa.parse(csvFile, {
            complete: async (result) => {
                const orders = result.data.map(row => ({
                    orderNumber: row[0],
                    createdAt: row[1]
                })).filter(order => order.orderNumber && order.createdAt);

                try {
                    const response = await axios.post(`${API_ENDPOINT}/bulk-insert-orders`,
                        { orders },
                        {
                            params: { action: 'bulkInsertOrders' },
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                    setPermanentMessage({ type: 'success', content: response.data.message });
                    fetchIncomingOrders();
                } catch (error) {
                    console.error('Error uploading orders:', error);
                    setPermanentMessage({ type: 'error', content: 'Failed to upload orders. Please try again.' });
                }
            },
            header: false
        });
    };

    useEffect(() => {
        fetchPendingDistributors();
        setDistributorsPage(1);
    }, [nameFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter]);

    useEffect(() => {
        fetchIncomingOrders();
        setOrdersPage(1);
    }, [incomingOrderFilter, incomingDateFilter, incomingStatusFilter]);

    const Pagination = ({ currentPage, setCurrentPage, totalItems }) => {
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

    return (
        <div className="relative font-roboto bg-gray-200">
            <div className="fixed top-0 left-0 right-0 bg-white z-10 shadow-md">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex flex-col items-start md:items-center">
                        <div
                            className="w-full flex flex-col md:flex-row items-start md:items-center md:justify-between mb-2">
                            <div className="flex flex-col md:flex-row w-full md:items-center">
                                <div className="flex justify-center md:justify-start">
                                    <img
                                        src="/images/smartyapps-logo.png"
                                        alt="SmartyApps.AI Logo"
                                        className="h-20 md:h-32 mb-1 md:mb-0"
                                    />
                                </div>
                                <div className="flex-grow flex justify-center">
                                    <div className="md:ml-4 flex flex-col md:border-l md:pl-4 text-center">
                                        <h2 className="text-lg md:text-xl text-gray-600 font-semibold">App Manager</h2>
                                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Owner Dashboard</h1>
                                    </div>
                                </div>

                                <div className="hidden md:block" style={{width: '128px'}}></div>
                            </div>
                        </div>
                        <div className="w-full max-w-2xl mt-1 md:mt-2">
                            <div
                                className={`p-2 rounded-lg w-full text-center text-sm min-h-[2rem] md:min-h-[2.5rem] flex items-center justify-center ${
                                    permanentMessage.content
                                        ? (permanentMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                                        : 'bg-gray-50 text-gray-400'
                                }`}>
                                {permanentMessage.content || 'No messages'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-8 max-w-6xl mx-auto pt-48 md:pt-48">
                <LinkGenerator
                    title="Unique Link"
                    link={uniqueLink}
                    copied={copiedUnique}
                    generateFn={() => generateLink('unique')}
                    copyFn={() => copyToClipboard(uniqueLink, setCopiedUnique)}
                />
                <LinkGenerator
                    title="Generic Link"
                    link={genericLink}
                    copied={copiedGeneric}
                    generateFn={() => generateLink('generic')}
                    copyFn={() => copyToClipboard(genericLink, setCopiedGeneric)}
                />
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Insert Order Number</h2>
                    <form onSubmit={insertOrderNumber}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                        <input
                            type="text"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
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
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Bulk Upload Incoming Orders</h2>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="mb-4"
                    />
                    <button
                        onClick={processAndUploadCSV}
                        className="w-full md:w-fit py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                    >
                        Upload CSV
                    </button>
                </div>
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Sync Orders and Distributors</h2>
                    <button
                        onClick={syncOrdersAndDistributors}
                        className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                    >
                        Sync Now
                    </button>
                </div>
                <DistributorGrid
                    distributors={pendingDistributors}
                    onDistributorClick={(distributor) => {
                        setSelectedDistributor(distributor);
                        setShowEditModal(true);
                    }}
                    onRefresh={fetchPendingDistributors}
                    nameFilterImmediate={nameFilterImmediate}
                    emailFilterImmediate={emailFilterImmediate}
                    orderFilterImmediate={orderFilterImmediate}
                    statusFilter={statusFilter}
                    linkTypeFilter={linkTypeFilter}
                    onNameFilterChange={(e) => {
                        setNameFilterImmediate(e.target.value);
                        setNameFilterDebounced(e.target.value);
                    }}
                    onEmailFilterChange={(e) => {
                        setEmailFilterImmediate(e.target.value);
                        setEmailFilterDebounced(e.target.value);
                    }}
                    onOrderFilterChange={(e) => {
                        setOrderFilterImmediate(e.target.value);
                        setOrderFilterDebounced(e.target.value);
                    }}
                    onStatusFilterChange={(e) => setStatusFilter(e.target.value)}
                    onLinkTypeFilterChange={(e) => setLinkTypeFilter(e.target.value)}
                    currentPage={distributorsPage}
                    itemsPerPage={itemsPerPage}
                    Pagination={
                        <Pagination
                            currentPage={distributorsPage}
                            setCurrentPage={setDistributorsPage}
                            totalItems={pendingDistributors.length}
                        />
                    }
                />

                <OrderGrid
                    orders={incomingOrders}
                    onRefresh={fetchIncomingOrders}
                    orderFilterImmediate={incomingOrderFilterImmediate}
                    dateFilter={incomingDateFilter}
                    statusFilter={incomingStatusFilter}
                    onOrderFilterChange={(e) => {
                        setIncomingOrderFilterImmediate(e.target.value);
                        setIncomingOrderFilterDebounced(e.target.value);
                    }}
                    onDateFilterChange={(e) => setIncomingDateFilter(e.target.value)}
                    onStatusFilterChange={(e) => setIncomingStatusFilter(e.target.value)}
                    currentPage={ordersPage}
                    itemsPerPage={itemsPerPage}
                    Pagination={
                        <Pagination
                            currentPage={ordersPage}
                            setCurrentPage={setOrdersPage}
                            totalItems={incomingOrders.length}
                        />
                    }
                />

            </div>
            {showEditModal && selectedDistributor && (
                <DistributorEditModal
                    distributor={selectedDistributor}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedDistributor(null);
                    }}
                    onSubmit={(formData) => handleDistributorUpdate(selectedDistributor.DistributorId, formData)}
                    isSubmitting={isUpdating}
                />
            )}
        </div>
    );
}