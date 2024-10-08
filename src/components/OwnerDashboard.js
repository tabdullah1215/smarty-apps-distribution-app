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

    // useEffect(() => {
    //     fetchPendingDistributors();
    // }, []);

    const generateLink = async (type) => {
        try {
            setError('');
            const result = await axios.post(`${API_ENDPOINT}/create-distributor`, { linkType: type });
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
        const url = `${API_ENDPOINT}/create-distributor`;
        console.log('Calling API at:', url);
        try {
            const response = await axios.post(url, { orderNumber });
            setOrderNumber('');
            setError('');
            console.log('Order number inserted successfully:', response.data);
        } catch (error) {
            console.error('Error inserting order number:', error);
            setError('Failed to insert order number. Please try again.');
        }
    };

    const fetchPendingDistributors = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINT}/pending-distributors`);
            setPendingDistributors(response.data);
        } catch (error) {
            console.error('Error fetching pending distributors:', error);
            setError('Failed to fetch pending distributors.');
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
                <h2 className="text-2xl font-semibold mb-4">Pending Distributors</h2>
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
        </div>
    );
}