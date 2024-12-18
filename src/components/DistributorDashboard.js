import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardHeader from './DashboardHeader';
import LinkGenerator from './LinkGenerator';
import { useAppPurchaseLink } from '../hooks/useAppPurchaseLink';
import authService from '../services/authService';
import { API_ENDPOINT } from '../config';
import InsertAppPurchaseOrder from './InsertAppPurchaseOrder';
import { useAppPurchaseOrders } from '../hooks/useAppPurchaseOrders';
import AppPurchaseOrderGrid from './AppPurchaseOrderGrid';
import Pagination from './Pagination';
import { useDebounce } from '../hooks/useDebounce';
import { usePendingAppUsers } from '../hooks/usePendingAppUsers';
import PendingAppUsersGrid from './PendingAppUsersGrid';
import AppUserEditModal from './AppUserEditModal';
import { useAppUserUpdate } from '../hooks/useAppUserUpdate';

function DistributorDashboard() {
    const userInfo = authService.getUserInfo();
    const [selectedApp, setSelectedApp] = useState('');
    const [permanentMessage, setPermanentMessage] = useState({ type: '', content: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [apps, setApps] = useState([]);
    const [orderNumber, setOrderNumber] = useState('');
    const [isInserting, setIsInserting] = useState(false);
    const { purchaseOrders, isRefreshing, fetchPurchaseOrders } = useAppPurchaseOrders(setPermanentMessage);
    const [ordersPage, setOrdersPage] = useState(1);
    const [orderFilter, setOrderFilter] = useState('');
    const [orderFilterImmediate, setOrderFilterImmediate] = useState('');
    const setOrderFilterDebounced = useDebounce((value) => setOrderFilter(value), 500);
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const itemsPerPage = 10;
    const [appUsersPage, setAppUsersPage] = useState(1);
    const [appFilter, setAppFilter] = useState('');
    const [appFilterImmediate, setAppFilterImmediate] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    const [emailFilterImmediate, setEmailFilterImmediate] = useState('');
    const [appUserOrderFilter, setAppUserOrderFilter] = useState('');
    const [appUserOrderFilterImmediate, setAppUserOrderFilterImmediate] = useState('');
    const [appUserStatusFilter, setAppUserStatusFilter] = useState('pending');
    const [selectedAppUser, setSelectedAppUser] = useState(null);
    const [showAppUserEditModal, setShowAppUserEditModal] = useState(false);
    const [appUserLinkTypeFilter, setAppUserLinkTypeFilter] = useState('');

    const setAppFilterDebounced = useDebounce((value) => setAppFilter(value), 500);
    const setEmailFilterDebounced = useDebounce((value) => setEmailFilter(value), 500);
    const setAppUserOrderFilterDebounced = useDebounce((value) => setAppUserOrderFilter(value), 500);

    const {
        uniquePurchaseLink,
        genericPurchaseLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generatePurchaseLink,
        copyToClipboard,
        generatingStates
    } = useAppPurchaseLink(setPermanentMessage);

    const {
        handleAppUserUpdate: updateAppUser,
        isUpdating: isAppUserUpdating
    } = useAppUserUpdate(
        (message, updatedData) => {
            setPermanentMessage({ type: 'success', content: message });
            fetchPendingAppUsers();
        },
        (errorMessage) => {
            setPermanentMessage({ type: 'error', content: errorMessage });
        }
    );

    const {
        pendingAppUsers,
        isRefreshing: isRefreshingAppUsers,
        fetchPendingAppUsers
    } = usePendingAppUsers(setPermanentMessage);

    useEffect(() => {
        fetchAvailableApps();
    }, []);

    useEffect(() => {
        fetchPurchaseOrders({
            orderFilter,
            dateFilter,
            statusFilter
        });
    }, [orderFilter, dateFilter, statusFilter]);

    useEffect(() => {
        fetchPendingAppUsers({
            appFilter,
            emailFilter,
            orderFilter: appUserOrderFilter,
            statusFilter: appUserStatusFilter,
            linkTypeFilter: appUserLinkTypeFilter
        });
    }, [appFilter, emailFilter, appUserOrderFilter, appUserStatusFilter, appUserLinkTypeFilter]);

    const fetchAvailableApps = async () => {
        try {
            setIsLoading(true);
            const token = authService.getToken();

            const response = await axios.post(
                `${API_ENDPOINT}/create-distributor`,
                {},
                {
                    params: { action: 'fetchAvailableApps' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.apps) {
                setApps(response.data.apps);
            }
        } catch (error) {
            console.error('Failed to fetch apps:', error);
            setPermanentMessage({
                type: 'error',
                content: 'Failed to load available apps'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOrderSubmit = async (e) => {
        e.preventDefault();
        setIsInserting(true);
        try {
            const token = authService.getToken();

            await axios.post(
                `${API_ENDPOINT}/create-distributor`,
                { orderNumber },
                {
                    params: { action: 'insertAppPurchaseOrder' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setPermanentMessage({
                type: 'success',
                content: 'Order number inserted successfully'
            });
            setOrderNumber('');
            fetchPurchaseOrders();
        } catch (error) {
            setPermanentMessage({
                type: 'error',
                content: error.response?.data?.message || 'Failed to insert order number'
            });
        } finally {
            setIsInserting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-200">
            <DashboardHeader
                title="Distributor Dashboard"
                centerContent={
                    <p className="text-gray-600">
                        Welcome, {userInfo?.email || 'User'}!
                    </p>
                }
                permanentMessage={permanentMessage}
            />
            <div className="p-8 max-w-6xl mx-auto pt-80 md:pt-60">
                <div className="bg-white rounded-lg shadow-md p-8 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Generate App Purchase Links</h2>
                    <div className="mb-6">
                        <label htmlFor="appSelect" className="block text-sm font-medium text-gray-700 mb-2">
                            Select App
                        </label>
                        <select
                            id="appSelect"
                            value={selectedApp}
                            onChange={(e) => setSelectedApp(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            disabled={isLoading}
                        >
                            <option value="">Select an app...</option>
                            {apps.map(app => (
                                <option key={app.AppId} value={app.AppId}>
                                    {app.Name} - ${app.Price}
                                </option>
                            ))}
                        </select>
                        {isLoading && (
                            <p className="mt-2 text-sm text-gray-500">Loading available apps...</p>
                        )}
                    </div>
                </div>

                {selectedApp && (
                    <>
                        <LinkGenerator
                            title="Unique Purchase Link"
                            link={uniquePurchaseLink}
                            copied={copiedUnique}
                            generateFn={() => generatePurchaseLink('unique', selectedApp)}
                            copyFn={() => copyToClipboard(uniquePurchaseLink, setCopiedUnique)}
                            isGenerating={generatingStates.unique}
                            description="For confirmed payments"
                        />
                        <LinkGenerator
                            title="Generic Purchase Link"
                            link={genericPurchaseLink}
                            copied={copiedGeneric}
                            generateFn={() => generatePurchaseLink('generic', selectedApp)}
                            copyFn={() => copyToClipboard(genericPurchaseLink, setCopiedGeneric)}
                            isGenerating={generatingStates.generic}
                            description="Requires order number verification"
                        />
                    </>
                )}

                <InsertAppPurchaseOrder
                    orderNumber={orderNumber}
                    onOrderNumberChange={(e) => setOrderNumber(e.target.value)}
                    onSubmit={handleOrderSubmit}
                    isInserting={isInserting}
                />

                <AppPurchaseOrderGrid
                    orders={purchaseOrders}
                    onRefresh={() => fetchPurchaseOrders({
                        orderFilter,
                        dateFilter,
                        statusFilter
                    })}
                    orderFilterImmediate={orderFilterImmediate}
                    dateFilter={dateFilter}
                    statusFilter={statusFilter}
                    onOrderFilterChange={(e) => {
                        setOrderFilterImmediate(e.target.value);
                        setOrderFilterDebounced(e.target.value);
                    }}
                    onDateFilterChange={(e) => setDateFilter(e.target.value)}
                    onStatusFilterChange={(e) => setStatusFilter(e.target.value)}
                    currentPage={ordersPage}
                    itemsPerPage={itemsPerPage}
                    isLoading={isRefreshing}
                    Pagination={
                        <Pagination
                            currentPage={ordersPage}
                            setCurrentPage={setOrdersPage}
                            totalItems={purchaseOrders.length}
                            itemsPerPage={itemsPerPage}
                        />
                    }
                />

                <PendingAppUsersGrid
                    appUsers={pendingAppUsers}
                    onAppUserClick={(appUser) => {
                        setSelectedAppUser(appUser);
                        setShowAppUserEditModal(true);
                    }}
                    onRefresh={() => fetchPendingAppUsers({
                        appFilter,
                        emailFilter,
                        orderFilter: appUserOrderFilter,
                        statusFilter: appUserStatusFilter,
                        linkTypeFilter: appUserLinkTypeFilter
                    })}
                    appFilterImmediate={appFilterImmediate}
                    emailFilterImmediate={emailFilterImmediate}
                    orderFilterImmediate={appUserOrderFilterImmediate}
                    statusFilter={appUserStatusFilter}
                    linkTypeFilter={appUserLinkTypeFilter}
                    onAppFilterChange={(e) => {
                        setAppFilterImmediate(e.target.value);
                        setAppFilterDebounced(e.target.value);
                    }}
                    onEmailFilterChange={(e) => {
                        setEmailFilterImmediate(e.target.value);
                        setEmailFilterDebounced(e.target.value);
                    }}
                    onOrderFilterChange={(e) => {
                        setAppUserOrderFilterImmediate(e.target.value);
                        setAppUserOrderFilterDebounced(e.target.value);
                    }}
                    onStatusFilterChange={(e) => setAppUserStatusFilter(e.target.value)}
                    onLinkTypeFilterChange={(e) => setAppUserLinkTypeFilter(e.target.value)}
                    currentPage={appUsersPage}
                    itemsPerPage={itemsPerPage}
                    isLoading={isRefreshingAppUsers}
                    availableApps={apps}
                    Pagination={
                        <Pagination
                            currentPage={appUsersPage}
                            setCurrentPage={setAppUsersPage}
                            totalItems={pendingAppUsers.length}
                            itemsPerPage={itemsPerPage}
                        />
                    }
                />
            </div>

            {showAppUserEditModal && selectedAppUser && (
                <AppUserEditModal
                    appUser={selectedAppUser}
                    onClose={() => {
                        setShowAppUserEditModal(false);
                        setSelectedAppUser(null);
                    }}
                    onSubmit={(formData) => updateAppUser(selectedAppUser.AppId, selectedAppUser.Email, formData)}
                    isSubmitting={isAppUserUpdating}
                    availableApps={apps}
                />
            )}
        </div>
    );
}

export default DistributorDashboard;