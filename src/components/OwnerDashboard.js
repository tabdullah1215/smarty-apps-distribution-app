import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { Copy } from 'lucide-react';
import Papa from 'papaparse';

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
                params: { action: 'getIncomingOrders' }
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
        fetchIncomingOrders();
    }, [nameFilter, orderFilter, statusFilter, linkTypeFilter]);

    const LinkGenerator = ({ title, link, copied, generateFn, copyFn }) => (
        <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">{title}</h2>
            <button
                onClick={generateFn}
                className="w-full py-4 px-6 text-xl font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition duration-300"
            >
                Generate {title}
            </button>
            {link && (
                <div className="mt-4 p-6 bg-gray-100 rounded-lg shadow-md">
                    <p className="text-xl font-semibold mb-4">Distributor Registration Link:</p>
                    <div className="flex items-stretch">
                        <div className="flex-grow p-4 bg-white rounded-l-lg border-2 border-r-0 border-gray-300 overflow-x-auto">
                            <p className="text-lg whitespace-nowrap">{link}</p>
                        </div>
                        <button
                            onClick={copyFn}
                            className="px-4 bg-gray-200 rounded-r-lg border-2 border-l-0 border-gray-300 hover:bg-gray-300 transition duration-300 flex items-center"
                            title="Copy to clipboard"
                        >
                            <Copy size={24} />
                        </button>
                    </div>
                    {copied && (
                        <p className="mt-2 text-green-600 font-semibold">Copied to clipboard!</p>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center">Owner Dashboard</h1>

            {/* Permanent message container */}
            <div className="mb-8 h-16 flex items-center justify-center">
                {permanentMessage.content && (
                    <div className={`p-4 rounded-lg w-full text-center ${
                        permanentMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                        {permanentMessage.content}
                    </div>
                )}
            </div>

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

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Insert Order Number</h2>
                <form onSubmit={insertOrderNumber} className="flex items-center">
                    <input
                        type="text"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="Enter order number"
                        className="flex-grow p-2 border rounded-l"
                        required
                    />
                    <button type="submit" className="py-2 px-4 bg-blue-500 text-white rounded-r">
                        Insert
                    </button>
                </form>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Bulk Upload Incoming Orders</h2>
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="mb-4"
                />
                <button
                    onClick={processAndUploadCSV}
                    className="py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                >
                    Upload CSV
                </button>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Sync Orders and Distributors</h2>
                <button
                    onClick={syncOrdersAndDistributors}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                >
                    Sync Now
                </button>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Distributors</h2>
                <div className="mb-4 grid grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Filter by Name"
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="p-2 border rounded"
                    />
                    <input
                        type="text"
                        placeholder="Filter by Order #"
                        value={orderFilter}
                        onChange={(e) => setOrderFilter(e.target.value)}
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
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Name</th>
                        <th className="border p-2">Order #</th>
                        <th className="border p-2">Status</th>
                        <th className="border p-2">Link Type</th>
                    </tr>
                    </thead>
                    <tbody>
                    {pendingDistributors.map((distributor, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                            <td className="border p-2">{distributor.DistributorName}</td>
                            <td className="border p-2">{distributor.OrderNumber || 'N/A'}</td>
                            <td className="border p-2">{distributor.Status}</td>
                            <td className="border p-2">{distributor.LinkType}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Incoming Orders</h2>
                <table className="w-full border-collapse border">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Order Number</th>
                        <th className="border p-2">Created At</th>
                        <th className="border p-2">Status</th>
                    </tr>
                    </thead>
                    <tbody>
                    {incomingOrders.map((order, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                            <td className="border p-2">{order.OrderNumber}</td>
                            <td className="border p-2">{new Date(order.CreatedAt).toLocaleString()}</td>
                            <td className="border p-2">{order.Status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}