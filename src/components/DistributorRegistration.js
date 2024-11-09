import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINT } from '../config';
import DashboardHeader from './DashboardHeader';

const generateRandomEmail = () => {
    const names = ['john', 'jane', 'bob', 'alice', 'mike', 'sarah', 'chris', 'emma'];
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    const randomNum = Math.floor(Math.random() * 10000);
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    return `${randomName}${randomNum}@${randomDomain}`;
};

const generateRandomDistributorName = () => {
    const prefixes = ['Global', 'Premier', 'Elite', 'Advanced', 'Pro', 'Superior', 'Master', 'Excel'];
    const businesses = ['Solutions', 'Distributors', 'Enterprises', 'Industries', 'Partners', 'Services', 'Networks', 'Logistics'];
    const suffixes = ['LLC', 'Inc', 'Co', 'Corporation', 'International', 'Group'];

    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomBusiness = businesses[Math.floor(Math.random() * businesses.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    return `${randomPrefix} ${randomBusiness} ${randomSuffix}`;
};

function DistributorRegistration() {
    const [email, setEmail] = useState(generateRandomEmail());
    const [password, setPassword] = useState('abc123');
    const [distributorName, setDistributorName] = useState(generateRandomDistributorName());
    const [companyName, setCompanyName] = useState('Test Company Ltd.');
    const [orderNumber, setOrderNumber] = useState('');
    const { linkType, token } = useParams();
    const navigate = useNavigate();
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });

    useEffect(() => {
        if (linkType === 'generic') {
            const randomOrderNumber = Math.floor(100000 + Math.random() * 900000).toString();
            setOrderNumber(randomOrderNumber);
        }
    }, [linkType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setPermanentMessage({ type: '', content: '' });
        try {
            const payload = {
                username: email,
                email,
                password,
                token,
                distributorName,
                companyName,
                linkType
            };

            if (linkType === 'generic') {
                payload.orderNumber = orderNumber;
            }

            const response = await axios.post(`${API_ENDPOINT}/create-distributor`,
                payload,
                {
                    params: { action: 'registerDistributor' },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data.message === 'Distributor registered successfully') {
                console.log('Distributor registration successful:', {
                    email,
                    distributorName,
                    companyName,
                    linkType,
                    orderNumber: linkType === 'generic' ? orderNumber : 'N/A'
                });

                // Navigate to login with success message
                navigate('/login', {
                    state: {
                        registration: 'success',
                        email: email,  // Pass username to pre-fill login form
                        message: 'Registration successful! Please log in with your credentials.'
                    }
                });
            } else {
                console.log("Unexpected response message:", response.data.message);
                setPermanentMessage({ type: 'error', content: 'Registration failed. Please try again.' });
            }
        } catch (error) {
            console.log('Distributor registration failed:', error.response?.data?.message || error.message);
            const errorMessage = error.response?.data?.message || 'An error occurred during registration. Please try again.';
            setPermanentMessage({ type: 'error', content: errorMessage });
        }
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Distributor Registration"
                subtitle={`Registration Type: ${linkType}`}
                permanentMessage={permanentMessage}
            />
            <div className="p-8 max-w-md mx-auto pt-96 md:pt-60">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block mb-1 text-sm font-medium">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block mb-1 text-sm font-medium">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="distributorName" className="block mb-1 text-sm font-medium">Distributor Name</label>
                            <input
                                id="distributorName"
                                type="text"
                                value={distributorName}
                                onChange={(e) => setDistributorName(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="companyName" className="block mb-1 text-sm font-medium">Company Name</label>
                            <input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>
                        {linkType === 'generic' && (
                            <div>
                                <label htmlFor="orderNumber" className="block mb-1 text-sm font-medium">Order Number</label>
                                <input
                                    id="orderNumber"
                                    type="text"
                                    value={orderNumber}
                                    onChange={(e) => setOrderNumber(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                        )}
                        <button type="submit" className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Register
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default DistributorRegistration;