import React, { useState } from 'react';

const AppUserEditModal = ({ appUser, onClose, onSubmit, isSubmitting = false, availableApps }) => {
    const [formData, setFormData] = useState({
        email: appUser?.Email || '',
        status: appUser?.Status || '',
        orderNumber: appUser?.OrderNumber || '',
        linkType: appUser?.LinkType || ''
    });

    // Helper to determine available status options
    const getStatusOptions = () => {
        const options = [];
        options.push({ value: '', label: 'Select Status' });

        // Always allow inactive
        options.push({ value: 'inactive', label: 'Inactive' });

        // Allow active except for pending generic registrations
        if (!(appUser.LinkType === 'generic' && appUser.Status === 'pending')) {
            options.push({ value: 'active', label: 'Active' });
        }

        // Always allow pending
        options.push({ value: 'pending', label: 'Pending' });

        return options;
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                <h2 className="text-xl font-semibold mb-4">Edit App User</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">App</label>
                        <input
                            type="text"
                            value={availableApps.find(app => app.AppId === appUser.AppId)?.Name || 'Unknown App'}
                            className="w-full p-2 border rounded bg-gray-100"
                            disabled={true}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            className="w-full p-2 border rounded bg-gray-100"
                            disabled={true}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Order Number</label>
                        <input
                            type="text"
                            value={formData.orderNumber}
                            className="w-full p-2 border rounded bg-gray-100"
                            disabled={true}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Link Type</label>
                        <input
                            type="text"
                            value={formData.linkType}
                            className="w-full p-2 border rounded bg-gray-100"
                            disabled={true}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="w-full p-2 border rounded"
                            disabled={isSubmitting}
                        >
                            {getStatusOptions().map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {appUser.LinkType === 'generic' && appUser.Status === 'pending' && (
                            <p className="mt-1 text-sm text-gray-500">
                                Generic registrations must be activated through order validation
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(formData)}
                        disabled={isSubmitting || Object.keys(formData).every(key => formData[key] === appUser[key])}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                        {isSubmitting ? 'Updating...' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppUserEditModal;