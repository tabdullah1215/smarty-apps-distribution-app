import React from 'react';

const AppUserEditModal = ({ appUser, onClose, onSubmit, isSubmitting, availableApps }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Edit App User</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        Close
                    </button>
                </div>
                <div className="space-y-4">
                    <p>User Email: {appUser.Email}</p>
                    <p>App: {availableApps.find(app => app.AppId === appUser.AppId)?.Name || 'Unknown App'}</p>
                    <p>Status: {appUser.Status}</p>
                    <p>Order Number: {appUser.OrderNumber || 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

export default AppUserEditModal;