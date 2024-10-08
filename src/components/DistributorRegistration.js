import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINT } from '../config';

function DistributorRegistration() {
    const [username, setUsername] = useState('testuser123');
    const [password, setPassword] = useState('TestPassword123!');
    const [distributorName, setDistributorName] = useState('Test Distributor Inc.');
    const [companyName, setCompanyName] = useState('Test Company Ltd.');
    const [orderNumber, setOrderNumber] = useState('');
    const [error, setError] = useState('');
    const { linkType, token } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (linkType === 'generic') {
            // Generate a random 6-digit order number
            const randomOrderNumber = Math.floor(100000 + Math.random() * 900000).toString();
            setOrderNumber(randomOrderNumber);
        }
    }, [linkType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');  // Reset error state
        try {
            const payload = {
                username,
                password,
                token,
                distributorName,
                companyName,
                linkType
            };

            // Include orderNumber for generic links
            if (linkType === 'generic') {
                payload.orderNumber = orderNumber;
            }

            // Make the API call to the Lambda function
            const response = await axios.post(`${API_ENDPOINT}/create-distributor`, payload);

            // Check the backend response for a success message
            if (response.data.message === 'Distributor registered successfully') {
                // Navigate to the next page on successful registration
                navigate('/distributor');
            } else {
                // Handle other unexpected cases
                setError('Registration failed. Please try again.');
            }
        } catch (error) {
            // Display the error message sent by the backend (Lambda)
            if (error.response && error.response.data && error.response.data.message) {
                setError(error.response.data.message);
            } else {
                // Fallback to a generic error message
                setError('An error occurred during registration. Please try again.');
            }
        }
    };

    return (
        <div className="p-8 max-w-md mx-auto">
            <h1 className="text-3xl font-bold mb-6">Distributor Registration</h1>
            <p className="mb-4">Registration Type: {linkType}</p>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block mb-1 text-sm font-medium">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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
    );
}

export default DistributorRegistration;