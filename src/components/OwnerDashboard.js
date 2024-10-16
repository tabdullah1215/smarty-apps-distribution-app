import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINT } from '../config';
import { Copy } from 'lucide-react';

export default function OwnerDashboard() {
    const [uniqueLink, setUniqueLink] = useState('');
    const [genericLink, setGenericLink] = useState('');
    const [copiedUnique, setCopiedUnique] = useState(false);
    const [copiedGeneric, setCopiedGeneric] = useState(false);
    const [error, setError] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [pendingDistributors, setPendingDistributors] = useState([]);
    const [syncMessage, setSyncMessage] = useState('');
    const [insertOrderMessage, setInsertOrderMessage] = useState('');
    const [incomingOrders, setIncomingOrders] = useState([]);
    const [nameFilter, setNameFilter] = useState('');
    const [orderFilter, setOrderFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [linkTypeFilter, setLinkTypeFilter] = useState('');

    const generateLink = async (type) => {
        try {
            setError('');
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
            } else {
                setError('Failed to generate link. Please try again.');
            }
        } catch (error) {
            console.error('Error generating link:', error);
            setError('An error occurred while generating the link. Please try again.');
        }
    };

    const copyToClipboard = (link, setCopied) => {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const insertOrderNumber = async (e) => {
        e.preventDefault();
        const url = `${API_ENDPOINT}/insert-order`;
        console.log('Calling API at:', url);
        try {
            setSyncMessage('');
            setInsertOrderMessage('');
            setError('');

            const response = await axios.post(url,
                { orderNumber },
                {
                    params: { action: 'insertOrder' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            console.log('Order insertion response:', response.data);

            if (response.data && response.data.message) {
                setInsertOrderMessage(`${response.data.message} - Order number: ${orderNumber}`);
                setOrderNumber('');
                fetchIncomingOrders(); // Refresh the incoming orders list
            } else {
                setError('Unexpected response from server. Please try again.');
            }
        } catch (error) {
            console.error('Error inserting order number:', error);
            setError(error.response?.data?.message || 'Failed to insert order number. Please try again.');
        }
    };

    const syncOrdersAndDistributors = async () => {
        try {
            setSyncMessage('');
            setError('');
            const response = await axios.post(`${API_ENDPOINT}/create-distributor`,
                {},
                {
                    params: { action: 'syncOrdersAndDistributors' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            setSyncMessage(response.data.message);
            fetchPendingDistributors();
            fetchIncomingOrders(); // Refresh both lists after sync
        } catch (error) {
            console.error('Error syncing orders and distributors:', error);
            setError('Failed to sync orders and distributors. Please try again.');
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
            setError('Failed to fetch pending distributors. Please try again.');
        }
    };

    useEffect(() => {
        fetchPendingDistributors();
        fetchIncomingOrders();
    }, [nameFilter, orderFilter, statusFilter, linkTypeFilter]);

    const fetchIncomingOrders = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINT}/get-incoming-orders`, {
                params: { action: 'getIncomingOrders' }
            });
            setIncomingOrders(response.data);
        } catch (error) {
            console.error('Error fetching incoming orders:', error);
            setError('Failed to fetch incoming orders. Please try again.');
        }
    };

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
            {error && <p className="text-red-500 mb-4">{error}</p>}
            {syncMessage && <p className="text-green-500 mb-4">{syncMessage}</p>}
            {insertOrderMessage && <p className="text-blue-500 mb-4">{insertOrderMessage}</p>}

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
                <h2 className="text-2xl font-semibold mb-4">Sync Orders and Distributors</h2>
                <button
                    onClick={syncOrdersAndDistributors}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 transition duration-300"
                >
                    Sync Now
                </button>
            </div>

            <div className="mt-8">
                <h2 className="text-2xl font-semibold mb-4">Pending Distributors</h2>
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
                    {/* ... (existing table header) */}
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