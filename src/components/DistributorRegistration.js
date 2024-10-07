import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINT } from '../config';

function DistributorRegistration() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [distributorName, setDistributorName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const { linkType, token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');  // Reset error state
        try {
            // Make the API call to the Lambda function
            const response = await axios.post(API_ENDPOINT, {
                username,
                password,
                token,
                distributorName,
                companyName,
                linkType  // Include the linkType in the request
            });

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
                <button type="submit" className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Register
                </button>
            </form>
        </div>
    );
}

export default DistributorRegistration;