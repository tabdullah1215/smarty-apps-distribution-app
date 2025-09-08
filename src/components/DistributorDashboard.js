import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DashboardHeader from './DashboardHeader';
import LinkGenerator from './LinkGenerator';
import { useAppPurchaseLink } from '../hooks/useAppPurchaseLink';
import authService from '../services/authService';
import {API_ENDPOINT, DEV_FEATURES} from '../config';
import InsertAppPurchaseOrder from './InsertAppPurchaseOrder';
import { useAppPurchaseOrders } from '../hooks/useAppPurchaseOrders';
import AppPurchaseOrderGrid from './AppPurchaseOrderGrid';
import Pagination from './Pagination';
import { useDebounce } from '../hooks/useDebounce';
import { usePendingAppUsers } from '../hooks/usePendingAppUsers';
import PendingAppUsersGrid from './PendingAppUsersGrid';
import AppUserEditModal from './AppUserEditModal';
import { useAppUserUpdate } from '../hooks/useAppUserUpdate';
import SyncAppUsersAndOrders from './SyncAppUsersAndOrders';
import { useSyncAppUsersAndOrders } from '../hooks/useSyncAppUsersAndOrders';
import BulkAppPurchaseOrders from './BulkAppPurchaseOrders';
import {useAppOrdersUpload} from "../hooks/useAppOrdersUpload";
import SubAppSelector from "./SubAppSelector";
import AppUserTestRegistration from './AppUserTestRegistration';

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
    // const [subAppFilter, setSubAppFilter] = useState('');
    // const [subAppFilterImmediate, setSubAppFilterImmediate] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    const [emailFilterImmediate, setEmailFilterImmediate] = useState('');
    const [appUserOrderFilter, setAppUserOrderFilter] = useState('');
    const [appUserOrderFilterImmediate, setAppUserOrderFilterImmediate] = useState('');
    const [appUserStatusFilter, setAppUserStatusFilter] = useState('pending');
    const [selectedAppUser, setSelectedAppUser] = useState(null);
    const [showAppUserEditModal, setShowAppUserEditModal] = useState(false);
    const [appUserLinkTypeFilter, setAppUserLinkTypeFilter] = useState('');
    const [selectedSubAppId, setSelectedSubAppId] = useState('');
    const [showDevTools, setShowDevTools] = useState(false);

    const [appFilter, setAppFilter] = useState('');
    const [appFilterImmediate, setAppFilterImmediate] = useState('');
    const setAppFilterDebounced = useDebounce((value) => setAppFilter(value), 500);

    // const setSubAppFilterDebounced = useDebounce((value) => setSubAppFilter(value), 500);
    const setEmailFilterDebounced = useDebounce((value) => setEmailFilter(value), 500);
    const setAppUserOrderFilterDebounced = useDebounce((value) => setAppUserOrderFilter(value), 500);

    const API_KEY = process.env.REACT_APP_API_KEY;
    const distributorId = authService.getUserInfo()?.sub;

    const showDevToolsForUser = DEV_FEATURES.TEST_REGISTRATION_ENABLED_FOR.includes(userInfo?.email);

    const bulkUploadRef = useRef(null);

    // const [emailRegistrationLink, setEmailRegistrationLink] = useState('');
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [sourceFilter, setSourceFilter] = useState('');
    const [selectedEmailSource, setSelectedEmailSource] = useState('kajabi');

    const {
        csvFile,
        isUploading,
        handleFileChange,
        processAndUploadCSV
    } = useAppOrdersUpload(
        setPermanentMessage,
        () => {
            fetchPurchaseOrders({
                orderFilter,
                dateFilter,
                statusFilter,
                sourceFilter
            });
        },
        bulkUploadRef
    );

    const { syncAppUsersAndOrders, isSyncing: isSyncingUsers } = useSyncAppUsersAndOrders(
        setPermanentMessage,
        async (isFromSync) => {
            await Promise.all([
                fetchPendingAppUsers({
                    appFilter,
                    emailFilter,
                    orderFilter: appUserOrderFilter,
                    statusFilter: appUserStatusFilter,
                    linkTypeFilter: appUserLinkTypeFilter
                }, isFromSync),
                fetchPurchaseOrders({
                    orderFilter,
                    dateFilter,
                    statusFilter,
                    sourceFilter
                }, isFromSync)
            ]);
        }
    );

    const {
        uniquePurchaseLink,
        genericPurchaseLink,
        emailRegistrationLink,
        copiedUnique,
        copiedGeneric,
        setCopiedUnique,
        setCopiedGeneric,
        generatePurchaseLink,
        copyToClipboard,
        generatingStates
    } = useAppPurchaseLink(setPermanentMessage);

    const { handleAppUserUpdate, isUpdating } = useAppUserUpdate(
        (message, updatedData) => {
            setPermanentMessage({ type: 'success', content: `${message} - User: ${updatedData.email}` });
            setSelectedAppUser(null);
            fetchPendingAppUsers({
                appFilter,
                emailFilter,
                orderFilter: appUserOrderFilter,
                statusFilter: appUserStatusFilter,
                linkTypeFilter: appUserLinkTypeFilter
            });
        },
        (errorMessage) => {
            setPermanentMessage({ type: 'error', content: `Update failed: ${errorMessage}` });
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
            statusFilter,
            sourceFilter
        });
    }, [orderFilter, dateFilter, statusFilter, sourceFilter]);

    useEffect(() => {
        console.log('Filters changed:', {
            appFilter,
            emailFilter,
            appUserOrderFilter,
            appUserStatusFilter,
            appUserLinkTypeFilter
        });
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
                `${API_ENDPOINT}/app-manager`,
                {},
                {
                    params: { action: 'fetchAvailableApps' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Api-Key': API_KEY
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
                `${API_ENDPOINT}/app-manager`,
                { orderNumber },
                {
                    params: { action: 'insertAppPurchaseOrder' },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Api-Key': API_KEY
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
                    {selectedApp && (
                        <SubAppSelector
                            appId={selectedApp}
                            selectedSubAppId={selectedSubAppId}
                            onSubAppIdChange={setSelectedSubAppId}
                            onChange={(e) => setSelectedSubAppId(e.target.value)}
                        />
                    )}
                </div>

                {selectedApp && (
                    <>
                        <LinkGenerator
                            title="Unique Purchase Link"
                            link={uniquePurchaseLink}
                            copied={copiedUnique}
                            generateFn={() => generatePurchaseLink('unique', selectedApp, selectedSubAppId)}
                            copyFn={() => copyToClipboard(uniquePurchaseLink, setCopiedUnique)}
                            isGenerating={generatingStates.unique}
                            description="For confirmed payments"
                        />
                        <LinkGenerator
                            title="Generic Purchase Link"
                            link={genericPurchaseLink}
                            copied={copiedGeneric}
                            generateFn={() => generatePurchaseLink('generic', selectedApp, selectedSubAppId)}
                            copyFn={() => copyToClipboard(genericPurchaseLink, setCopiedGeneric)}
                            isGenerating={generatingStates.generic}
                            description="Requires order number verification"
                        />
                        {selectedApp && selectedSubAppId && (
                            <>
                                {/* NEW: Email Registration Link Generator with Source Selection */}
                                <div className="bg-white rounded-lg shadow-md p-8 mb-8">
                                    <h2 className="text-xl font-semibold mb-4">Email Registration Link</h2>
                                    <p className="text-sm text-gray-600 mb-4">For store-based purchases (Kajabi, Whop, Stan, etc.)</p>

                                    {/* Source Selection Dropdown */}
                                    <div className="mb-4">
                                        <label htmlFor="emailSourceSelect" className="block text-sm font-medium text-gray-700 mb-2">
                                            Select Store Source
                                        </label>
                                        <select
                                            id="emailSourceSelect"
                                            value={selectedEmailSource}
                                            onChange={(e) => setSelectedEmailSource(e.target.value)}
                                            className="w-full p-2 border rounded-md"
                                        >
                                            <option value="kajabi">Kajabi</option>
                                            <option value="whop">Whop</option>
                                            <option value="stan">Stan</option>
                                        </select>
                                    </div>

                                    <LinkGenerator
                                        title={`Email Registration Link (${selectedEmailSource})`}
                                        link={emailRegistrationLink}
                                        copied={copiedEmail}
                                        generateFn={() => generatePurchaseLink('email', selectedApp, selectedSubAppId, selectedEmailSource)}
                                        copyFn={() => copyToClipboard(emailRegistrationLink, setCopiedEmail)}
                                        isGenerating={generatingStates.email}
                                        description={`Registration link for ${selectedEmailSource} store purchases`}
                                    />
                                </div>
                            </>
                        )}

                    </>
                )}

                {showDevToolsForUser && (
                    <div className="mt-10 border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Developer Testing Tools</h3>
                            <button
                                onClick={() => setShowDevTools(!showDevTools)}
                                className="text-sm px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
                            >
                                {showDevTools ? 'Hide Tools' : 'Show Tools'}
                            </button>
                        </div>

                        {showDevTools && (
                            <AppUserTestRegistration
                                distributorId={distributorId}
                                selectedApp={selectedApp}
                                selectedSubAppId={selectedSubAppId}
                                availableApps={apps}
                                uniquePurchaseLink={uniquePurchaseLink}
                                genericPurchaseLink={genericPurchaseLink}
                            />
                        )}
                    </div>
                )}

                <InsertAppPurchaseOrder
                    orderNumber={orderNumber}
                    onOrderNumberChange={(e) => setOrderNumber(e.target.value)}
                    onSubmit={handleOrderSubmit}
                    isInserting={isInserting}
                />

                <BulkAppPurchaseOrders
                    csvFile={csvFile}
                    onCsvUpload={handleFileChange}
                    onProcessCsv={processAndUploadCSV}
                    isUploading={isUploading}
                    fileInputRef={bulkUploadRef}
                />

                <SyncAppUsersAndOrders
                    onSync={syncAppUsersAndOrders}
                    isSyncing={isSyncingUsers}
                />

                <AppPurchaseOrderGrid
                    orders={purchaseOrders}
                    onRefresh={() => fetchPurchaseOrders({
                        orderFilter,
                        dateFilter,
                        statusFilter,
                        sourceFilter
                    })}
                    orderFilterImmediate={orderFilterImmediate}
                    dateFilter={dateFilter}
                    statusFilter={statusFilter}
                    sourceFilter={sourceFilter}
                    onOrderFilterChange={(e) => {
                        setOrderFilterImmediate(e.target.value);
                        setOrderFilterDebounced(e.target.value);
                    }}
                    onDateFilterChange={(e) => setDateFilter(e.target.value)}
                    onStatusFilterChange={(e) => setStatusFilter(e.target.value)}
                    onSourceFilterChange={(e) => setSourceFilter(e.target.value)}
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
                    appUsers={Array.isArray(pendingAppUsers) ? pendingAppUsers : []}
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
                    onLinkTypeFilterChange={(e) => {
                        console.log('Link type filter changed:', e.target.value);
                        setAppUserLinkTypeFilter(e.target.value);
                    }}
                    currentPage={appUsersPage}
                    itemsPerPage={itemsPerPage}
                    isLoading={isRefreshingAppUsers}
                    availableApps={apps}
                    Pagination={
                        <Pagination
                            currentPage={appUsersPage}
                            setCurrentPage={setAppUsersPage}
                            totalItems={(Array.isArray(pendingAppUsers) ? pendingAppUsers : []).length}
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
                    onSubmit={async (formData) => {
                        await handleAppUserUpdate(selectedAppUser.AppId, selectedAppUser.Email, {
                            ...formData,
                            subAppId: selectedAppUser.SubAppId
                        });
                    }}
                    isSubmitting={isUpdating}
                    availableApps={apps}
                />
            )}
        </div>
    );
}

export default DistributorDashboard;