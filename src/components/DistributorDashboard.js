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
import { Copy } from 'lucide-react';

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
    const [sourceFilter, setSourceFilter] = useState('');

    // NEW FILTERS - Add only these new filter variables
    const [appIdFilter, setAppIdFilter] = useState('');
    const [customerNameFilter, setCustomerNameFilter] = useState('');
    const [productNameFilter, setProductNameFilter] = useState('');
    const [appIdFilterImmediate, setAppIdFilterImmediate] = useState('');
    const [customerNameFilterImmediate, setCustomerNameFilterImmediate] = useState('');
    const [productNameFilterImmediate, setProductNameFilterImmediate] = useState('');

    // NEW FILTER DEBOUNCING - Add debouncing for new filters
    const [appIdFilterDebounced, setAppIdFilterDebounced] = useState('');
    const [customerNameFilterDebounced, setCustomerNameFilterDebounced] = useState('');
    const [productNameFilterDebounced, setProductNameFilterDebounced] = useState('');

    const itemsPerPage = 10;
    const [appUsersPage, setAppUsersPage] = useState(1);
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

    const setEmailFilterDebounced = useDebounce((value) => setEmailFilter(value), 500);
    const setAppUserOrderFilterDebounced = useDebounce((value) => setAppUserOrderFilter(value), 500);

    const API_KEY = process.env.REACT_APP_API_KEY;
    const distributorId = authService.getUserInfo()?.sub;

    const showDevToolsForUser = DEV_FEATURES.TEST_REGISTRATION_ENABLED_FOR.includes(userInfo?.email);

    const bulkUploadRef = useRef(null);

    const [copiedEmail, setCopiedEmail] = useState(false);
    const [selectedEmailSource, setSelectedEmailSource] = useState('kajabi');

    const [copiedDistributorId, setCopiedDistributorId] = useState(false);

    // NEW FILTER DEBOUNCING EFFECTS - Add these useEffect hooks for new filters
    useEffect(() => {
        const timer = setTimeout(() => setAppIdFilterDebounced(appIdFilter), 500);
        return () => clearTimeout(timer);
    }, [appIdFilter]);

    useEffect(() => {
        const timer = setTimeout(() => setCustomerNameFilterDebounced(customerNameFilter), 500);
        return () => clearTimeout(timer);
    }, [customerNameFilter]);

    useEffect(() => {
        const timer = setTimeout(() => setProductNameFilterDebounced(productNameFilter), 500);
        return () => clearTimeout(timer);
    }, [productNameFilter]);

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
                sourceFilter,
                // ADD NEW FILTERS HERE
                appIdFilter: appIdFilterDebounced,
                customerNameFilter: customerNameFilterDebounced,
                productNameFilter: productNameFilterDebounced
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
                    sourceFilter,
                    // ADD NEW FILTERS HERE
                    appIdFilter: appIdFilterDebounced,
                    customerNameFilter: customerNameFilterDebounced,
                    productNameFilter: productNameFilterDebounced
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
            setShowAppUserEditModal(false);
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
            sourceFilter,
            // ADD NEW FILTERS HERE
            appIdFilter: appIdFilterDebounced,
            customerNameFilter: customerNameFilterDebounced,
            productNameFilter: productNameFilterDebounced
        });
    }, [orderFilter, dateFilter, statusFilter, sourceFilter, appIdFilterDebounced, customerNameFilterDebounced, productNameFilterDebounced]);

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

    const copyDistributorIdToClipboard = () => {
        const textToCopy = distributorId;

        // Create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setCopiedDistributorId(true);
                setTimeout(() => setCopiedDistributorId(false), 2000);
            } else {
                // Fallback to showing the ID in an alert
                alert(`Distributor ID: ${textToCopy}`);
            }
        } catch (err) {
            // If even execCommand fails, show the ID
            alert(`Copy this Distributor ID: ${textToCopy}`);
        } finally {
            document.body.removeChild(textarea);
        }
    };

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
            fetchPurchaseOrders({
                orderFilter,
                dateFilter,
                statusFilter,
                sourceFilter,
                // ADD NEW FILTERS HERE
                appIdFilter: appIdFilterDebounced,
                customerNameFilter: customerNameFilterDebounced,
                productNameFilter: productNameFilterDebounced
            });
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
                    <div className="text-center">
                        <p className="text-gray-600">
                            Welcome, {userInfo?.email || 'User'}!
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">
                                ID: {distributorId || 'N/A'}
                            </span>
                            {distributorId && (
                                <button
                                    onClick={copyDistributorIdToClipboard}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Copy Distributor ID"
                                >
                                    <Copy size={14} />
                                </button>
                            )}
                            {copiedDistributorId && (
                                <span className="text-xs text-green-600 font-medium">Copied!</span>
                            )}
                        </div>
                    </div>
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
                            disabled={!selectedSubAppId}
                            description="For confirmed payments"
                        />

                        <LinkGenerator
                            title="Generic Purchase Link"
                            link={genericPurchaseLink}
                            copied={copiedGeneric}
                            generateFn={() => generatePurchaseLink('generic', selectedApp, selectedSubAppId)}
                            copyFn={() => copyToClipboard(genericPurchaseLink, setCopiedGeneric)}
                            isGenerating={generatingStates.generic}
                            disabled={!selectedSubAppId}
                            description="Requires order number verification"
                        />

                        {/* Email Registration Link - Now visible when app is selected, disabled until subapp is selected */}
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
                                    disabled={!selectedSubAppId}
                                >
                                    <option value="kajabi">Kajabi</option>
                                    <option value="whop">Whop</option>
                                    <option value="stan">Stan</option>
                                </select>
                                {!selectedSubAppId && (
                                    <p className="mt-1 text-sm text-gray-500">Select a SubApp to enable store source selection</p>
                                )}
                            </div>

                            <LinkGenerator
                                title={`Email Registration Link (${selectedEmailSource})`}
                                link={emailRegistrationLink}
                                copied={copiedEmail}
                                generateFn={() => generatePurchaseLink('email', selectedApp, selectedSubAppId, selectedEmailSource)}
                                copyFn={() => copyToClipboard(emailRegistrationLink, setCopiedEmail)}
                                isGenerating={generatingStates.email}
                                disabled={!selectedSubAppId}
                                description={`Registration link for ${selectedEmailSource} store purchases`}
                            />
                        </div>
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
                        sourceFilter,
                        // ADD NEW FILTERS HERE
                        appIdFilter: appIdFilterDebounced,
                        customerNameFilter: customerNameFilterDebounced,
                        productNameFilter: productNameFilterDebounced
                    })}
                    orderFilterImmediate={orderFilterImmediate}
                    dateFilter={dateFilter}
                    statusFilter={statusFilter}
                    sourceFilter={sourceFilter}
                    // ADD NEW FILTER PROPS HERE
                    appIdFilter={appIdFilterImmediate}
                    customerNameFilter={customerNameFilterImmediate}
                    productNameFilter={productNameFilterImmediate}
                    onOrderFilterChange={(e) => {
                        setOrderFilterImmediate(e.target.value);
                        setOrderFilterDebounced(e.target.value);
                    }}
                    onDateFilterChange={(e) => setDateFilter(e.target.value)}
                    onStatusFilterChange={(e) => setStatusFilter(e.target.value)}
                    onSourceFilterChange={(e) => setSourceFilter(e.target.value)}
                    // ADD NEW FILTER HANDLERS HERE
                    onAppIdFilterChange={(e) => {
                        setAppIdFilterImmediate(e.target.value);
                        setAppIdFilter(e.target.value);
                    }}
                    onCustomerNameFilterChange={(e) => {
                        setCustomerNameFilterImmediate(e.target.value);
                        setCustomerNameFilter(e.target.value);
                    }}
                    onProductNameFilterChange={(e) => {
                        setProductNameFilterImmediate(e.target.value);
                        setProductNameFilter(e.target.value);
                    }}
                    currentPage={ordersPage}
                    itemsPerPage={itemsPerPage}
                    isLoading={isRefreshing}
                    availableApps={apps}
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
                    onAppUserClick={(user) => {
                        setSelectedAppUser(user);
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
                    isLoading={isRefreshingAppUsers}
                    currentPage={appUsersPage}
                    itemsPerPage={itemsPerPage}
                    availableApps={apps}
                    Pagination={
                        <Pagination
                            currentPage={appUsersPage}
                            setCurrentPage={setAppUsersPage}
                            totalItems={Array.isArray(pendingAppUsers) ? pendingAppUsers.length : 0}
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