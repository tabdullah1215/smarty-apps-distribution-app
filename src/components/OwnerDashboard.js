import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { Copy, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';

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
    const [uniqueLink, setUniqueLink] = useState('');
    const [genericLink, setGenericLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);
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

    // Add these new state variables
    const [nameFilterImmediate, setNameFilterImmediate] = useState('');
    const [emailFilterImmediate, setEmailFilterImmediate] = useState('');
    const [orderFilterImmediate, setOrderFilterImmediate] = useState('');
    const [incomingOrderFilterImmediate, setIncomingOrderFilterImmediate] = useState('');

// Create debounced setters
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

    // Add this near the top of OwnerDashboard.js after imports

    const generateLink = async (type) => {
        try {
            setPermanentMessage({ type: '', content: '' });
            const result = await axios.post(`${API_ENDPOINT}/create-distributor`,
                { linkType: type },
                {
                    params: { action: 'generateToken' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            console.log('result:', result);
            if (result.data && result.data.token) {
                const link = `${window.location.origin}/register/${type}/${result.data.token}`;
                if (type === 'unique') {
                    setUniqueLink(link);
                } else {
                    setGenericLink(link);
                }
                setPermanentMessage({ type: 'success', content: `${type.charAt(0).toUpperCase() + type.slice(1)} link generated successfully.` });
            } else {
                setPermanentMessage({ type: 'error', content: 'Failed to generate link. Please try again.' });
            }
        } catch (error) {
            console.error('Error generating link:', error);
            setPermanentMessage({ type: 'error', content: 'An error occurred while generating the link. Please try again.' });
        }
    };

    const copyToClipboard = (link, setCopied) => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            setPermanentMessage({ type: 'success', content: 'Link copied to clipboard.' });
        });
    };

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

// Modify the useEffect hooks that call these functions
    useEffect(() => {
        fetchPendingDistributors();
        // Reset to page 1 when filters change
        setDistributorsPage(1);
    }, [nameFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter]);

    useEffect(() => {
        fetchIncomingOrders();
        // Reset to page 1 when filters change
        setOrdersPage(1);
    }, [incomingOrderFilter, incomingDateFilter, incomingStatusFilter]);

    const LinkGenerator = ({ title, link, copied, generateFn, copyFn }) => (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <button
                onClick={generateFn}
                className="w-full py-4 px-6 text-xl font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300"
            >
                Generate {title}
            </button>
            <div className="mt-4 p-6 bg-gray-100 rounded-lg shadow-md">
                <p className="text-lg font-semibold mb-4">Distributor Registration Link:</p>
                {link ? (
                    <div className="flex items-stretch">
                        <div className="flex-grow p-4 bg-white rounded-l-lg border-2 border-r-0 border-gray-300 overflow-x-auto">
                            <p className="text-base whitespace-nowrap">{link}</p>
                        </div>
                        <button
                            onClick={copyFn}
                            className="px-4 bg-gray-200 rounded-r-lg border-2 border-l-0 border-gray-300 hover:bg-gray-300 transition duration-300 flex items-center"
                            title="Copy to clipboard"
                        >
                            <Copy size={24} />
                        </button>
                    </div>
                ) : (
                    <div className="p-4 bg-white rounded-lg border-2 border-gray-300">
                        <p className="text-base text-gray-500 italic">No link generated yet.</p>
                    </div>
                )}
                {copied && (
                    <p className="mt-2 text-green-600 font-semibold">Copied to clipboard!</p>
                )}
            </div>
        </div>
    );

    const Pagination = ({ currentPage, setCurrentPage, totalItems }) => {
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

        useEffect(() => {
            // Only update if the current page is different from the valid page
            // and we have items (to prevent unnecessary updates during initial load)
            if (currentPage !== validCurrentPage && totalItems > 0) {
                setCurrentPage(validCurrentPage);
            }
        }, [currentPage, validCurrentPage, setCurrentPage, totalItems]);

        // Don't show pagination if there are no items
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

    const handleDistributorUpdate = async (updatedData) => {
        try {
            setPermanentMessage({ type: '', content: '' });
            const response = await axios.post(`${API_ENDPOINT}/create-distributor`,
                {
                    distributorId: selectedDistributor.DistributorId,
                    ...updatedData
                },
                {
                    params: { action: 'updateDistributor' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data && response.data.message) {
                setPermanentMessage({ type: 'success', content: response.data.message });
                if (updatedData.status) {  // Add this condition
                    setStatusFilter(updatedData.status);  // Add this line
                }
                fetchPendingDistributors(); // Refresh with current filters
                setShowEditModal(false);
            }
        } catch (error) {
            console.error('Error updating distributor:', error);
            setPermanentMessage({ type: 'error', content: error.response?.data?.message || 'Failed to update distributor' });
            setShowEditModal(false);
            setSelectedDistributor(null);
        }
    };

// Rename the modal component to reflect its broader purpose
    const DistributorEditModal = ({ distributor, onClose, onSubmit }) => {
        const [formData, setFormData] = useState({
            distributorName: distributor?.DistributorName || '',
            email: distributor?.Email || '',
            companyName: distributor?.CompanyName || '',
            status: distributor?.Status || '',
            username: distributor?.Username || ''
        });

        const handleChange = (field, value) => {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                    <h2 className="text-xl font-semibold mb-4">Edit Distributor</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Distributor Name</label>
                            <input
                                type="text"
                                value={formData.distributorName}
                                onChange={(e) => handleChange('distributorName', e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Company Name</label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={(e) => handleChange('companyName', e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">Select Status</option>
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit(formData)}
                            disabled={Object.keys(formData).every(key => formData[key] === distributor[key])}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                            Update
                        </button>
                    </div>
                </div>
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
                                {/* Center logo and make it smaller on mobile */}
                                <div className="flex justify-center md:justify-start">
                                    <img
                                        src="/images/smartyapps-logo.png"
                                        alt="SmartyApps.AI Logo"
                                        className="h-20 md:h-32 mb-1 md:mb-0"
                                    />
                                </div>
                                {/* Center container for App Manager and Owner Dashboard */}
                                <div className="flex-grow flex justify-center">
                                    <div className="md:ml-4 flex flex-col md:border-l md:pl-4 text-center">
                                        <h2 className="text-lg md:text-xl text-gray-600 font-semibold">App Manager</h2>
                                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Owner Dashboard</h1>
                                    </div>
                                </div>
                                {/* Add an empty div to balance the logo width */}
                                <div className="hidden md:block" style={{width: '128px'}}></div>
                                {/* 128px matches h-32 logo */}
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

            <div className="p-8 max-w-6xl mx-auto pt-64 md:pt-48">
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

                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Distributors</h2>
                        <button
                            onClick={() => fetchPendingDistributors()}
                            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300"
                            title="Refresh distributors"
                        >
                            <RefreshCw size={16}/>
                            <span>Refresh</span>
                        </button>
                    </div>
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <input
                            type="text"
                            placeholder="Filter by Name"
                            value={nameFilterImmediate}
                            onChange={(e) => {
                                setNameFilterImmediate(e.target.value);
                                setNameFilterDebounced(e.target.value);
                            }}
                            className="p-2 border rounded"
                        />
                        <input
                            type="text"
                            placeholder="Filter by Email"
                            value={emailFilterImmediate}
                            onChange={(e) => {
                                setEmailFilterImmediate(e.target.value);
                                setEmailFilterDebounced(e.target.value);
                            }}
                            className="p-2 border rounded"
                        />
                        <input
                            type="text"
                            placeholder="Filter by Order #"
                            value={orderFilterImmediate}
                            onChange={(e) => {
                                setOrderFilterImmediate(e.target.value);
                                setOrderFilterDebounced(e.target.value);
                            }}
                            className="p-2 border rounded"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="p-2 border rounded"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <select
                            value={linkTypeFilter}
                            onChange={(e) => setLinkTypeFilter(e.target.value)}
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
                                <th className="border p-2">Name</th>
                                <th className="border p-2">Email</th>
                                <th className="border p-2">Order #</th>
                                <th className="border p-2">Status</th>
                                <th className="border p-2">Link Type</th>
                            </tr>
                            </thead>
                            <tbody>
                            {pendingDistributors
                                .slice((distributorsPage - 1) * itemsPerPage, distributorsPage * itemsPerPage)
                                .map((distributor, index) => (
                                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                        <td className="border p-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedDistributor(distributor);
                                                    setShowEditModal(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                                            >
                                                {distributor.DistributorName}
                                            </button>
                                        </td>
                                        <td className="border p-2">{distributor.Email || 'N/A'}</td>
                                        <td className="border p-2">{distributor.OrderNumber || 'N/A'}</td>
                                        <td className="border p-2">{distributor.Status}</td>
                                        <td className="border p-2">{distributor.LinkType}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={distributorsPage}
                        setCurrentPage={setDistributorsPage}
                        totalItems={pendingDistributors.length}
                    />
                </div>

                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Incoming Orders</h2>
                        <button
                            onClick={() => fetchIncomingOrders()}
                            className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition duration-300"
                            title="Refresh orders"
                        >
                            <RefreshCw size={16}/>
                            <span>Refresh</span>
                        </button>
                    </div>
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="Filter by Order #"
                            value={incomingOrderFilterImmediate}
                            onChange={(e) => {
                                setIncomingOrderFilterImmediate(e.target.value);
                                setIncomingOrderFilterDebounced(e.target.value);
                            }}
                            className="p-2 border rounded"
                        />
                        <div className="w-full relative">
                            <input
                                type="date"
                                value={incomingDateFilter}
                                onChange={(e) => setIncomingDateFilter(e.target.value)}
                                className={`p-2 border rounded w-full max-w-full ${!incomingDateFilter ? 'text-transparent' : ''}`}
                                style={{
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                    appearance: 'none',
                                    minWidth: 'auto',  // Kept from previous fix
                                    maxWidth: '100%'   // Added to reinforce max-w-full
                                }}
                                onFocus={(e) => e.target.showPicker()}
                            />
                            {!incomingDateFilter && (
                                <span
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                                        Filter by Date
                                </span>
                            )}
                        </div>
                        <select
                            value={incomingStatusFilter}
                            onChange={(e) => setIncomingStatusFilter(e.target.value)}
                            className="p-2 border rounded"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="used">Used</option>
                        </select>
                    </div>
                    <div className="h-[440px] overflow-y-auto">
                        <table className="w-full border-collapse border">
                            <thead>
                            <tr className="bg-gray-200">
                                <th className="border p-2">Order Number</th>
                                <th className="border p-2">Created At</th>
                                <th className="border p-2">Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {incomingOrders
                                .slice((ordersPage - 1) * itemsPerPage, ordersPage * itemsPerPage)
                                .map((order, index) => (
                                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                                        <td className="border p-2">{order.OrderNumber}</td>
                                        <td className="border p-2">{new Date(order.CreatedAt).toLocaleString()}</td>
                                        <td className="border p-2">{order.Status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={ordersPage}
                        setCurrentPage={setOrdersPage}
                        totalItems={incomingOrders.length}
                    />
                </div>
            </div>
            {showEditModal && selectedDistributor && (
                <DistributorEditModal
                    distributor={selectedDistributor}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedDistributor(null);
                    }}
                    onSubmit={handleDistributorUpdate}
                />
            )}
        </div>
    );
}