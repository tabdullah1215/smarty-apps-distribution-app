import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

const EnhancedAppRegistration = ({ token, appId, subAppId }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        orderNumber: ''
    });
    const [purchaseValidation, setPurchaseValidation] = useState({
        isValidated: false,
        source: null, // 'marketplace' or 'order' or null
        purchaseId: null,
        amount: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });

    useEffect(() => {
        // Check URL parameters for marketplace purchase ID
        const urlParams = new URLSearchParams(window.location.search);
        const marketplacePurchaseId = urlParams.get('purchase_id');
        const purchaseAmount = urlParams.get('amount');

        if (marketplacePurchaseId) {
            // Pre-fill email if provided from marketplace
            const customerEmail = urlParams.get('email');
            if (customerEmail) {
                setFormData(prev => ({ ...prev, email: customerEmail }));
            }

            setPurchaseValidation({
                isValidated: true,
                source: 'marketplace',
                purchaseId: marketplacePurchaseId,
                amount: purchaseAmount
            });

            setMessage({
                type: 'success',
                content: 'Your purchase has been verified! Complete your registration below.'
            });
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ type: '', content: '' });

        try {
            const registrationPayload = {
                token,
                appId,
                email: formData.email,
                password: formData.password
            };

            // Add marketplace purchase ID if available
            if (purchaseValidation.source === 'marketplace') {
                registrationPayload.marketplacePurchaseId = purchaseValidation.purchaseId;
                registrationPayload.purchaseAmount = purchaseValidation.amount;
            } else if (formData.orderNumber) {
                // Use existing order number validation
                registrationPayload.orderNumber = formData.orderNumber;
            }

            const response = await fetch('/api/app-manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': process.env.REACT_APP_API_KEY
                },
                body: JSON.stringify(registrationPayload)
            });

            const result = await response.json();

            if (response.ok) {
                setMessage({
                    type: 'success',
                    content: 'Registration successful! Redirecting to your app...'
                });

                // Redirect to app with success
                setTimeout(() => {
                    window.location.href = `/app/${appId}/${subAppId}/welcome`;
                }, 2000);
            } else {
                setMessage({
                    type: 'error',
                    content: result.message || 'Registration failed. Please try again.'
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                content: 'Network error. Please check your connection and try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Complete Your Registration
                </h1>
                <p className="text-gray-600">
                    Get instant access to your app
                </p>
            </div>

            {/* Purchase Status Indicator */}
            {purchaseValidation.isValidated && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                        <Check className="text-green-600" size={20} />
                        <div>
                            <p className="text-green-800 font-medium">Purchase Verified</p>
                            <p className="text-green-700 text-sm">
                                {purchaseValidation.source === 'marketplace'
                                    ? `Marketplace purchase confirmed${purchaseValidation.amount ? ` - $${purchaseValidation.amount}` : ''}`
                                    : 'Order number validated'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Display */}
            {message.content && (
                <div className={`mb-4 p-3 rounded-lg border ${
                    message.type === 'error'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-green-50 border-green-200 text-green-800'
                }`}>
                    <div className="flex items-center space-x-2">
                        {message.type === 'error' ?
                            <AlertCircle size={16} /> :
                            <Check size={16} />
                        }
                        <span className="text-sm">{message.content}</span>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isSubmitting}
                        readOnly={purchaseValidation.source === 'marketplace' && formData.email}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Create Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={isSubmitting}
                        minLength="6"
                    />
                </div>

                {/* Order Number Field - Only show if no marketplace purchase */}
                {!purchaseValidation.isValidated && (
                    <div>
                        <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                            Order Number
                        </label>
                        <input
                            id="orderNumber"
                            type="text"
                            value={formData.orderNumber}
                            onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your order number"
                            disabled={isSubmitting}
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Order number from your purchase confirmation
                        </p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Creating Account...</span>
                        </>
                    ) : (
                        <span>Complete Registration</span>
                    )}
                </button>
            </form>

            {/* Help Text */}
            <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                    Having trouble? Contact support for assistance.
                </p>
            </div>
        </div>
    );
};

export default EnhancedAppRegistration;