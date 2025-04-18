const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand, QueryCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const DEFAULT_BUDGET_TYPE = 'paycheck';
// const bcrypt = require('bcryptjs');

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = '24h';
// const SALT_ROUNDS = 10;

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
};

const actionConfig = {
    // Public actions (no auth required)
    verifyEmail: { public: true },
    verifyCredentials: { public: true },
    verifyAppPurchase: { public: true },
    registerDistributor: { public: true },
    verifyToken: { public: true },
    appLogin: { public: true },
    getPublicSubappInfo: { public: true },

    // Owner only actions
    syncOrdersAndDistributors: { role: 'Owner' },
    getDistributors: { role: 'Owner' },
    getIncomingOrders: { role: 'Owner' },
    bulkInsertOrders: { role: 'Owner' },
    updateDistributor: { role: 'Owner' },
    generateToken: { role: 'Owner' },
    insertOrder: { role: 'Owner' },

    // Distributor only actions
    syncAppUsers: { role: 'Distributor' },
    getPendingAppUsers: { role: 'Distributor' },
    fetchAvailableApps: { role: 'Distributor' },
    generatePurchaseToken: { role: 'Distributor' },
    insertAppPurchaseOrder: { role: 'Distributor' },
    getAppPurchaseOrders: { role: 'Distributor' },
    updateAppUser: { role: 'Distributor' },
    bulkInsertAppPurchaseOrder: { role: 'Distributor' },
    getSubAppsForApp: { role: 'Distributor' },
};

// Password hashing utilities
// async function hashPassword(password) {
//     return bcrypt.hash(password, SALT_ROUNDS);
// }


// JWT utilities
function generateToken(user) {
    return jwt.sign(
        {
            sub: user.DistributorId,
            email: user.Email,
            role: user.Role,
            distributorName: user.DistributorName,
            status: user.Status
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
    );
}

async function handleVerifyEmail(body) {
    console.log('Processing verify email request');
    try {
        if (!body.email || !body.appId) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Email and appId are required'
            });
        }

        const result = await ddbDocClient.send(new GetCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                Email: body.email
            }
        }));

        return createResponse(200, {
            exists: !!result.Item,
            user: result.Item ? true : false
        });
    } catch (error) {
        return handleLambdaError(error, 'handleVerifyEmail');
    }
}

async function handleUpdateAppUser(body, event) {
    try {
        if (!body.appId || !body.email) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'App ID and email are required'
            });
        }

        const distributorId = event.user.sub;

        // First get the current user state
        const currentUser = await ddbDocClient.send(new GetCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                Email: body.email
            }
        }));

        if (!currentUser.Item) {
            return createResponse(404, {
                code: 'USER_NOT_FOUND',
                message: 'App user not found'
            });
        }

        if (currentUser.Item.DistributorId !== distributorId) {
            return createResponse(403, {
                code: 'FORBIDDEN',
                message: 'Cannot update app users belonging to other distributors'
            });
        }

        // Status change validation
        if (body.status === 'active' &&
            currentUser.Item.LinkType === 'generic' &&
            currentUser.Item.Status === 'pending') {
            return createResponse(400, {
                code: 'INVALID_STATUS_CHANGE',
                message: 'Generic registrations must be activated through order validation'
            });
        }

        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        // Map of fields that can be updated
        const updatableFields = {
            status: 'Status'
        };

        // Build update expression for each field that has a value
        Object.entries(updatableFields).forEach(([key, dbField]) => {
            if (body[key] !== undefined) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = dbField;
                expressionAttributeValues[`:${key}`] = body[key];
            }
        });

        if (updateExpressions.length === 0) {
            return createResponse(400, { message: 'No fields to update' });
        }

        // Update the app user
        const result = await ddbDocClient.send(new UpdateCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                Email: body.email
            },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));

        return createResponse(200, {
            message: 'App user updated successfully',
            appId: body.appId,
            email: body.email,
            updatedUser: result.Attributes
        });
    } catch (error) {
        console.error('Error updating app user:', error);
        return handleLambdaError(error, 'handleUpdateAppUser');
    }
}

async function handleSyncAppUsers(event) {
    try {
        // 1. Auth verification (matching other handlers)
        // removed

        // 2. Get pending orders for this distributor
        const distributorId = event.user.sub;
        const pendingOrdersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: '(attribute_not_exists(#status) OR #status = :pendingStatus) AND DistributorId = :distributorId',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: {
                ':pendingStatus': 'pending',
                ':distributorId': distributorId
            }
        }));

        // 3. Get pending users for this distributor
        const pendingUsersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppUsers',
            FilterExpression: '#status = :pendingStatus AND DistributorId = :distributorId',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: {
                ':pendingStatus': 'pending',
                ':distributorId': distributorId
            }
        }));

        const transactItems = [];
        let matchedPairs = 0;

        for (const order of pendingOrdersResult.Items) {
            const matchingUser = pendingUsersResult.Items.find(
                user => user.OrderNumber === order.OrderNumber &&
                    user.DistributorId === order.DistributorId
            );

            if (matchingUser) {
                transactItems.push({
                    Update: {
                        TableName: 'AppPurchaseOrders',
                        Key: {
                            DistributorId: order.DistributorId,
                            OrderNumber: order.OrderNumber
                        },
                        UpdateExpression: 'SET #status = :usedStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':usedStatus': 'used' }
                    }
                });

                transactItems.push({
                    Update: {
                        TableName: 'AppUsers',
                        Key: {
                            AppId: matchingUser.AppId,
                            Email: matchingUser.Email
                        },
                        UpdateExpression: 'SET #status = :activeStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':activeStatus': 'active' }
                    }
                });

                matchedPairs++;

                if (transactItems.length === 25) {
                    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
                    transactItems.length = 0;
                }
            }
        }

        if (transactItems.length > 0) {
            await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        }

        // 4. Enhanced response with detailed stats
        return createResponse(200, {
            code: 'SYNC_SUCCESS',
            message: `Sync completed. Updated ${matchedPairs} pairs.`,
            stats: {
                processedOrders: pendingOrdersResult.Items.length,
                processedUsers: pendingUsersResult.Items.length,
                matchedPairs: matchedPairs
            }
        });

    } catch (error) {
        console.error('Error syncing app users:', error);
        return handleLambdaError(error, 'handleSyncAppUsers');
    }
}

async function handleGetPendingAppUsers(event) {
    try {

        const distributorId = event.user.sub;

        console.log('Fetching pending app users');
        const { appFilter, emailFilter, orderFilter, dateFilter, statusFilter, linkTypeFilter } = event.queryStringParameters || {};

        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': distributorId
        };

        if (appFilter) {
            filterExpression.push('AppId = :appFilter');
            expressionAttributeValues[':appFilter'] = appFilter;
        }

        if (emailFilter) {
            filterExpression.push('contains(Email, :emailFilter)');
            expressionAttributeValues[':emailFilter'] = emailFilter;
        }

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        if (linkTypeFilter) {
            filterExpression.push('LinkType = :linkTypeFilter');
            expressionAttributeValues[':linkTypeFilter'] = linkTypeFilter;
        }

        const scanParams = {
            TableName: 'AppUsers',
            FilterExpression: filterExpression.join(' AND '),
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues
        };

        console.log('Scan params:', JSON.stringify(scanParams, null, 2)); // Added for debugging
        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('App users fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching app users:', error);
        return createResponse(500, { message: 'Error fetching app users', error: error.message });
    }
}
async function handleFetchAvailableApps(event) {
    try {
        console.log('Processing fetchAvailableApps request');
        console.log('Auth header:', event.headers.Authorization);

        const distributorId = event.user.sub;

        // Get apps assigned to this distributor
        const distributorAppsResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'DistributorApps',
            KeyConditionExpression: 'DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':distributorId': distributorId
            }
        }));

        if (!distributorAppsResult.Items || distributorAppsResult.Items.length === 0) {
            return createResponse(200, { apps: [] });
        }

        // Get full app details
        const appIds = distributorAppsResult.Items.map(item => ({
            AppId: item.AppId
        }));

        const appsResult = await ddbDocClient.send(new BatchGetCommand({
            RequestItems: {
                'Apps': {
                    Keys: appIds
                }
            }
        }));

        const availableApps = appsResult.Responses.Apps
            .filter(app => app.Status === 'active')
            .map(app => ({
                ...app,
                commission: distributorAppsResult.Items.find(
                    da => da.AppId === app.AppId
                ).CommissionRate
            }));

        return createResponse(200, { apps: availableApps });
    } catch (error) {
        console.error('Error fetching available apps:', error);
        return handleLambdaError(error, 'handleFetchAvailableApps');
    }
}

async function handleGenerateAppPurchaseToken(body, event) {
    console.log('Generating new app purchase token', {
        receivedBody: body,
        distributorId: body.distributorId,
        hasAuth: !!event.headers.Authorization
    });

    try {
        if (!body.linkType || !body.appId || !body.distributorId || !body.subAppId) {
            console.log('Missing required fields:', {
                hasLinkType: !!body.linkType,
                hasAppId: !!body.appId,
                hasDistributorId: !!body.distributorId,
                hasSubAppId: !!body.subAppId
            });
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Link type, app ID, distributor ID, and subApp ID are required for purchase token generation'
            });
        }

        const distributorId = event.user.sub;

        if (distributorId !== body.distributorId) {
            return createResponse(403, {
                code: 'FORBIDDEN',
                message: 'Cannot generate token for another distributor'
            });
        }

        // Get app info
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        console.log('App lookup result:', {
            found: !!appResult.Item,
            status: appResult.Item?.Status
        });

        if (!appResult.Item || appResult.Item.Status !== 'active') {
            return createResponse(403, {
                code: 'APP_NOT_AVAILABLE',
                message: 'App is not currently available for purchase'
            });
        }

        // Verify the subAppId is valid for this app
        console.log('Verifying SubAppId validity using AppSubAppMapping table');
        const mappingResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppSubAppMapping',
            Key: {
                AppId: body.appId,
                SubAppId: body.subAppId
            }
        }));

        console.log('SubAppId mapping lookup result:', {
            found: !!mappingResult.Item,
            appId: body.appId,
            subAppId: body.subAppId
        });

        if (!mappingResult.Item) {
            return createResponse(400, {
                code: 'INVALID_SUBAPP_ID',
                message: 'The provided SubApp ID is not valid for this application'
            });
        }

        // Verify the specific app is available for this distributor
        const appDistributorResult = await ddbDocClient.send(new GetCommand({
            TableName: 'DistributorApps',
            Key: {
                DistributorId: body.distributorId,
                AppId: body.appId
            }
        }));

        console.log('Distributor-App relationship lookup result:', {
            found: !!appDistributorResult.Item,
            distributorId: body.distributorId,
            appId: body.appId
        });

        if (!appDistributorResult.Item) {
            return createResponse(403, {
                code: 'APP_NOT_AUTHORIZED',
                message: 'Distributor is not authorized to sell this app'
            });
        }

        // Generate token
        const token = crypto.randomBytes(16).toString('hex');
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(); // 30 days expiry

        const tokenItem = {
            Token: token,
            CreatedAt: createdAt,
            ExpiresAt: expiresAt,
            LinkType: body.linkType,
            AppId: body.appId,
            SubAppId: body.subAppId, // Add the SubAppId
            DistributorId: body.distributorId,
            Status: body.linkType === 'unique' ? 'pending' : 'active'
        };

        await ddbDocClient.send(new PutCommand({
            TableName: 'AppPurchaseTokens',
            Item: tokenItem
        }));

        console.log('App purchase token generated:', {
            token,
            appId: body.appId,
            subAppId: body.subAppId, // Log the SubAppId
            distributorId: body.distributorId,
            linkType: body.linkType,
            status: tokenItem.Status
        });

        return createResponse(200, {
            token,
            expiresAt,
            status: tokenItem.Status,
            appDomain: appResult.Item.AppDomain,
            subAppId: body.subAppId // Return the SubAppId in the response
        });

    } catch (error) {
        console.error('Error generating app purchase token:', error);
        if (error.name === 'ValidationException') {
            return createResponse(400, {
                code: 'VALIDATION_ERROR',
                message: 'Invalid data format provided'
            });
        }
        return handleLambdaError(error, 'handleGenerateAppPurchaseToken');
    }
}
async function handleAppLogin(body) {
    try {
        if (!body.appId || !body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_CREDENTIALS',
                message: 'App ID, email and password are required'
            });
        }

        // Get app info
        const appResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Apps',
            Key: { AppId: body.appId }
        }));

        const appName = appResult.Item?.Name;

        // Existing user lookup code
        const userResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppUsers',
            Key: {
                AppId: body.appId,
                Email: body.email
            }
        }));

        if (!userResult.Item || userResult.Item.Password !== body.password) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        if (userResult.Item.Status !== 'active' && userResult.Item.Status !== 'pending') {
            return createResponse(403, {
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is not active'
            });
        }

        // Include SubAppId in JWT token
        const token = jwt.sign(
            {
                sub: userResult.Item.Email,
                appId: body.appId,
                appName: appName,
                subAppId: userResult.Item.SubAppId || 'all', // Default to 'all' if not set
                status: userResult.Item.Status
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        return createResponse(200, {
            token,
            user: {
                email: userResult.Item.Email,
                status: userResult.Item.Status,
                appName: appName,
                subAppId: userResult.Item.SubAppId || 'all'
            }
        });
    } catch (error) {
        return handleLambdaError(error, 'handleAppLogin');
    }
}
async function handleFetchAppPurchaseOrders(event) {
    try {

        const distributorId = event.user.sub;

        console.log('Fetching app purchase orders');
        const { orderFilter, dateFilter, statusFilter } = event.queryStringParameters || {};

        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': distributorId
        };

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        const scanParams = {
            TableName: 'AppPurchaseOrders',
            FilterExpression: filterExpression.join(' AND '),
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('App purchase orders fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching app purchase orders:', error);
        return handleLambdaError(error, 'handleFetchAppPurchaseOrders');
    }
}

async function handleInsertAppPurchaseOrder(body, event) {
    console.log('Processing insert app purchase order request');
    try {
        if (!body.orderNumber) {
            return createResponse(400, {
                code: 'MISSING_ORDER_NUMBER',
                message: 'Order number is required'
            });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, {
                code: 'INVALID_ORDER_NUMBER',
                message: sanitizationError.message
            });
        }

        let distributorId = event.user.sub;

        // First check for duplicate within distributor scope
        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber,
                ':distributorId': distributorId
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists for this distributor'
            });
        }

        // Check for global uniqueness due to HASH key constraint
        try {
            console.log('Attempting to insert order:', {
                orderNumber: sanitizedOrderNumber,
                distributorId: distributorId
            });

            const putResult = await ddbDocClient.send(new PutCommand({
                TableName: 'AppPurchaseOrders',
                Item: {
                    OrderNumber: sanitizedOrderNumber,
                    CreatedAt: new Date().toISOString(),
                    Status: 'pending',
                    DistributorId: distributorId
                },
                ConditionExpression: 'attribute_not_exists(OrderNumber)'
            }));

            console.log('PutCommand result:', putResult);

            return createResponse(200, {
                code: 'SUCCESS',
                message: 'Order number inserted successfully',
                orderNumber: sanitizedOrderNumber,
                timestamp: new Date().toISOString()
            });

        } catch (putError) {
            console.error('PutCommand error details:', {
                name: putError.name,
                code: putError.code,
                message: putError.message,
                type: putError.$metadata?.httpStatusCode
            });

            if (putError.name === 'ConditionalCheckFailedException') {
                return createResponse(409, {
                    code: 'GLOBAL_DUPLICATE_ORDER',
                    message: 'Order number already exists in the system'
                });
            }

            throw putError; // Re-throw to be caught by outer catch and handled by handleLambdaError
        }

    } catch (error) {
        console.error('Error in handleInsertAppPurchaseOrder:', {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorType: error.$metadata?.httpStatusCode
        });
        return handleLambdaError(error, 'handleInsertAppPurchaseOrder');
    }
}

async function handleGetSubAppsForApp(event) {
    console.log("getSubAppsForApp called with:", {
        queryStringParameters: event.queryStringParameters,
        body: JSON.parse(event.body || '{}'),
        httpMethod: event.httpMethod
    });
    try {
        const appId = event.queryStringParameters?.appId;

        if (!appId) {
            return createResponse(400, {
                code: 'MISSING_APP_ID',
                message: 'App ID is required'
            });
        }

        // Query the mapping table for all SubAppIds for this AppId
        const queryResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'AppSubAppMapping',
            KeyConditionExpression: 'AppId = :appId',
            ExpressionAttributeValues: {
                ':appId': appId
            }
        }));

        // Return the list of SubAppIds with their metadata
        return createResponse(200, queryResult.Items || []);
    } catch (error) {
        console.error('Error fetching SubApps for App:', error);
        return handleLambdaError(error, 'handleGetSubAppsForApp');
    }
}

async function handleVerifyAppPurchase(body) {
    console.log('Processing app purchase verification');
    try {
        if (!body.token || !body.appId || !body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Token, app ID, email, and password are required'
            });
        }

        // Verify the purchase token
        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'AppPurchaseTokens',
            Key: { Token: body.token }
        }));

        if (!tokenResult.Item) {
            return createResponse(400, {
                code: 'INVALID_TOKEN',
                message: 'Invalid purchase token'
            });
        }

        // Check token expiration
        if (new Date(tokenResult.Item.ExpiresAt) < new Date()) {
            return createResponse(400, {
                code: 'TOKEN_EXPIRED',
                message: 'Purchase token has expired'
            });
        }

        // Verify token status based on type
        if ((tokenResult.Item.LinkType === 'unique' && tokenResult.Item.Status !== 'pending') ||
            (tokenResult.Item.LinkType === 'generic' && tokenResult.Item.Status !== 'active')) {
            return createResponse(400, {
                code: 'INVALID_TOKEN_STATUS',
                message: 'Registration link is invalid or has already been used'
            });
        }

        const purchaseDate = new Date().toISOString();
        // Set initial status based on link type - generic is always pending
        let purchaseStatus = tokenResult.Item.LinkType === 'unique' ? 'active' : 'pending';

        // For generic links, only validate order number uniqueness within distributor scope
        if (tokenResult.Item.LinkType === 'generic' && body.orderNumber) {
            try {
                const sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);

                // Check if order number already used for another user
                const existingUserScan = await ddbDocClient.send(new ScanCommand({
                    TableName: 'AppUsers',
                    FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitizedOrderNumber,
                        ':distributorId': tokenResult.Item.DistributorId
                    }
                }));

                if (existingUserScan.Items && existingUserScan.Items.length > 0) {
                    return createResponse(400, {
                        code: 'ORDER_ALREADY_USED',
                        message: 'Order number has already been used for a purchase'
                    });
                }
            } catch (sanitizationError) {
                return createResponse(400, {
                    code: 'INVALID_ORDER_NUMBER',
                    message: sanitizationError.message
                });
            }
        }

        const transactItems = [
            {
                Put: {
                    TableName: 'AppUsers',
                    Item: {
                        AppId: body.appId,
                        Email: body.email,
                        Password: body.password,
                        Status: purchaseStatus,
                        CreatedAt: purchaseDate,
                        Token: body.token,
                        OrderNumber: body.orderNumber || null,
                        DistributorId: tokenResult.Item.DistributorId,
                        LinkType: tokenResult.Item.LinkType,
                        SubAppId: tokenResult.Item.SubAppId // Include SubAppId in the user record
                    },
                    ConditionExpression: 'attribute_not_exists(AppId) AND attribute_not_exists(Email)'
                }
            }
        ];

        // Update token status for unique links
        if (tokenResult.Item.LinkType === 'unique') {
            transactItems.push({
                Update: {
                    TableName: 'AppPurchaseTokens',
                    Key: { Token: body.token },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        await ddbDocClient.send(new TransactWriteCommand({
            TransactItems: transactItems
        }));

        return createResponse(200, {
            message: 'App registration successful',
            status: purchaseStatus,
            subAppId: tokenResult.Item.SubAppId
        });

    } catch (error) {
        console.error('Error processing app purchase:', error);
        return handleLambdaError(error, 'handleVerifyAppPurchase');
    }
}
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

async function verifyAuthToken(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
        return null;
    }
    const token = authHeader.replace('Bearer ', '');
    return verifyToken(token);
}

async function handleVerifyCredentials(body) {
    console.log('Processing verify credentials request');
    try {
        if (!body.email || !body.password) {
            return createResponse(400, {
                code: 'MISSING_CREDENTIALS',
                message: 'Email and password are required'
            });
        }

        let result;
        try {
            result = await ddbDocClient.send(new QueryCommand({
                TableName: 'Distributors',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'Email = :email',
                ExpressionAttributeValues: {
                    ':email': body.email
                }
            }));
        } catch (dbError) {
            console.error('Database query failed:', dbError);
            return handleLambdaError({
                name: 'DatabaseQueryError',
                message: 'Failed to query distributor data',
                cause: dbError,
                code: 'DATABASE_ERROR'
            }, 'handleVerifyCredentials.query');
        }

        if (!result.Items || result.Items.length === 0) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        const distributor = result.Items[0];

        // Add specific error if distributor object is malformed
        if (!distributor.Password) {
            return handleLambdaError({
                name: 'DataIntegrityError',
                message: 'Distributor record is missing required fields'
            }, 'handleVerifyCredentials.validation');
        }

        const passwordValid = distributor.Password === body.password;

        if (!passwordValid) {
            return createResponse(401, {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password'
            });
        }

        if (distributor.Status !== 'active' && distributor.Status !== 'pending') {
            return createResponse(403, {
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is not active'
            });
        }

        try {
            const token = generateToken(distributor);
            console.log('Login successful for user:', distributor.Email);

            return createResponse(200, {
                token,
                user: {
                    email: distributor.Email,
                    distributorName: distributor.DistributorName,
                    status: distributor.Status,
                    role: distributor.Role
                }
            });
        } catch (tokenError) {
            return handleLambdaError({
                name: 'TokenGenerationError',
                message: 'Failed to generate authentication token',
                cause: tokenError
            }, 'handleVerifyCredentials.token');
        }

    } catch (error) {
        return handleLambdaError(error, 'handleVerifyCredentials');
    }
}
async function handleVerifyToken(event) {
    console.log('Processing verify token request');
    try {
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader) {
            console.log('No authorization header present');
            return createResponse(401, {
                code: 'MISSING_AUTH_HEADER',
                message: 'No authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = verifyToken(token);

        if (!decoded) {
            console.log('Invalid token provided');
            return createResponse(401, {
                code: 'INVALID_TOKEN',
                message: 'Invalid token'
            });
        }

        const userResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Distributors',
            Key: { DistributorId: decoded.sub }
        }));

        if (!userResult.Item) {
            console.log('User no longer exists:', decoded.sub);
            return createResponse(401, { message: 'User no longer exists' });
        }

        if (userResult.Item.Status !== 'active') {
            console.log('User account not active:', decoded.sub);
            return createResponse(401, { message: 'User account is not active' });
        }

        console.log('Token successfully verified for user:', decoded.email);
        return createResponse(200, { valid: true, user: decoded });
    } catch (error) {
        console.error('Error verifying token:', error);
        return createResponse(500, { message: 'Error verifying token', error: error.message });
    }
}


exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    let currentAction = '';

    try {
        const action = event.queryStringParameters?.action;
        currentAction = action;

        if (!action) {
            return createResponse(400, {
                code: 'MISSING_ACTION',
                message: 'Missing action parameter'
            });
        }

        const config = actionConfig[action];
        if (!config) {
            return createResponse(400, {
                code: 'INVALID_ACTION',
                message: 'Invalid action parameter'
            });
        }

        let decodedToken;
        // Auth check for non-public actions
        if (!config.public) {
            decodedToken = await verifyAuthToken(event);
            if (!decodedToken) {
                return createResponse(401, {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                });
            }

            // Role check
            if (config.role && decodedToken.role !== config.role) {
                return createResponse(403, {
                    code: 'FORBIDDEN',
                    message: `This action requires ${config.role} role`
                });
            }
        }

        let body = {};
        if (event.httpMethod === 'POST') {
            try {
                body = JSON.parse(event.body || '{}');
            } catch (error) {
                return createResponse(400, {
                    code: 'INVALID_JSON',
                    message: 'Invalid JSON in request body'
                });
            }
        }

        // Attach auth info to event if authenticated
        if (decodedToken) {
            event.user = decodedToken;
        }

        // Handle actions
        switch (action) {
            // Public actions
            case 'verifyEmail':
                return await handleVerifyEmail(body);
            case 'verifyCredentials':
                return await handleVerifyCredentials(body);
            case 'verifyAppPurchase':
                return await handleVerifyAppPurchase(body);
            case 'registerDistributor':
                return await handleRegisterDistributor(body);
            case 'verifyToken':
                return await handleVerifyToken(event);
            case 'appLogin':
                return await handleAppLogin(body);
            case 'getPublicSubappInfo':
                return await handleGetPublicSubappInfo(event);
            // Owner actions
            case 'syncOrdersAndDistributors':
                return await handleSyncOrdersAndDistributors(event);
            case 'getDistributors':
                return await handleFetchPendingDistributors(event);
            case 'getIncomingOrders':
                return await handleFetchIncomingOrders(event);
            case 'bulkInsertOrders':
                return await handleBulkInsertOrders(body, event);
            case 'updateDistributor':
                return await handleUpdateDistributor(body, event);
            case 'generateToken':
                return await handleGenerateToken(body, event);
            case 'insertOrder':
                return await handleInsertOrder(body, event);

            // Distributor actions
            case 'syncAppUsers':
                return await handleSyncAppUsers(event);
            case 'getPendingAppUsers':
                return await handleGetPendingAppUsers(event);
            case 'fetchAvailableApps':
                return await handleFetchAvailableApps(event);
            case 'generatePurchaseToken':
                return await handleGenerateAppPurchaseToken(body, event);
            case 'insertAppPurchaseOrder':
                return await handleInsertAppPurchaseOrder(body, event);
            case 'getAppPurchaseOrders':
                return await handleFetchAppPurchaseOrders(event);
            case 'updateAppUser':
                return await handleUpdateAppUser(body, event);
            case 'bulkInsertAppPurchaseOrder':
                return await handleBulkInsertAppPurchaseOrder(body, event);
            case 'getSubAppsForApp':
                return await handleGetSubAppsForApp(event);

            default:
                return createResponse(400, {
                    code: 'INVALID_ACTION',
                    message: 'Invalid action'
                });
        }
    } catch (error) {
        return handleLambdaError(error, currentAction);
    }
};

async function handleBulkInsertAppPurchaseOrder(body, event) {
    console.log('Processing bulk insert app purchase order request');
    try {
        if (!body.orderNumbers || !Array.isArray(body.orderNumbers)) {
            return createResponse(400, {
                code: 'MISSING_ORDER_NUMBERS',
                message: 'Array of order numbers is required'
            });
        }

        const distributorId = event.user.sub;
        const results = {
            successful: [],
            failed: [],
            duplicates: []
        };

        // Process each order number through the same sanitization as single orders
        const sanitizedOrders = await Promise.all(body.orderNumbers.map(async (orderNumber) => {
            try {
                const sanitized = sanitizeOrderNumber(orderNumber);

                // Check for duplicate using same logic as single insert
                const existingOrder = await ddbDocClient.send(new ScanCommand({
                    TableName: 'AppPurchaseOrders',
                    FilterExpression: 'OrderNumber = :orderNumber AND DistributorId = :distributorId',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitized,
                        ':distributorId': distributorId
                    }
                }));

                if (existingOrder.Items && existingOrder.Items.length > 0) {
                    return {
                        orderNumber: sanitized,
                        isDuplicate: true
                    };
                }

                return {
                    orderNumber: sanitized,
                    isDuplicate: false
                };
            } catch (error) {
                return {
                    orderNumber,
                    isError: true,
                    error: error.message
                };
            }
        }));

        // Categorize orders based on validation results
        for (const order of sanitizedOrders) {
            if (order.isError) {
                results.failed.push({
                    orderNumber: order.orderNumber,
                    reason: order.error
                });
            } else if (order.isDuplicate) {
                results.duplicates.push({
                    orderNumber: order.orderNumber,
                    reason: 'Order number already exists for this distributor'
                });
            } else {
                results.successful.push({
                    orderNumber: order.orderNumber,
                    status: 'pending'
                });
            }
        }

        // Insert valid orders in batches
        if (results.successful.length > 0) {
            const batchSize = 25; // DynamoDB limit
            for (let i = 0; i < results.successful.length; i += batchSize) {
                const batch = results.successful.slice(i, i + batchSize);
                const putRequests = batch.map(({ orderNumber }) => ({
                    PutRequest: {
                        Item: {
                            OrderNumber: orderNumber,
                            DistributorId: distributorId,
                            CreatedAt: new Date().toISOString(),
                            Status: 'pending'
                        }
                    }
                }));

                try {
                    await ddbDocClient.send(new BatchWriteCommand({
                        RequestItems: {
                            'AppPurchaseOrders': putRequests
                        }
                    }));
                } catch (error) {
                    console.error('Error inserting batch:', error);
                    // Move failed batch items to failed results
                    batch.forEach(({ orderNumber }) => {
                        const indexInSuccess = results.successful.findIndex(
                            s => s.orderNumber === orderNumber
                        );
                        if (indexInSuccess !== -1) {
                            results.successful.splice(indexInSuccess, 1);
                            results.failed.push({
                                orderNumber,
                                reason: 'Database insertion failed'
                            });
                        }
                    });
                }
            }
        }

        // Prepare response message
        const message = `Processed ${body.orderNumbers.length} orders: ` +
            `${results.successful.length} inserted successfully, ` +
            `${results.duplicates.length} duplicates skipped, ` +
            `${results.failed.length} failed.`;

        return createResponse(200, {
            code: 'SUCCESS',
            message,
            results
        });

    } catch (error) {
        console.error('Error in bulk insert app purchase orders:', error);
        return handleLambdaError(error, 'handleBulkInsertAppPurchaseOrder');
    }
}

function handleLambdaError(error, context = '') {
    console.error(`Error in ${context}:`, error);

    // JWT specific errors
    if (error.name === 'JsonWebTokenError') {
        return createResponse(401, {
            code: 'INVALID_TOKEN',
            message: 'Invalid or malformed JWT token'
        });
    }
    if (error.name === 'TokenExpiredError') {
        return createResponse(401, {
            code: 'TOKEN_EXPIRED',
            message: 'JWT token has expired'
        });
    }
    if (error.name === 'TokenGenerationError') {
        return createResponse(500, {
            code: 'TOKEN_GENERATION_FAILED',
            message: 'Failed to generate authentication token'
        });
    }

    // Database errors
    if (error.name === 'DatabaseQueryError') {
        return createResponse(500, {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed'
        });
    }
    if (error.name === 'DataIntegrityError') {
        return createResponse(500, {
            code: 'DATA_INTEGRITY_ERROR',
            message: 'Data integrity issue detected'
        });
    }
    if (error.name === 'ConditionalCheckFailedException') {
        return createResponse(409, {
            code: 'CONDITION_FAILED',
            message: 'Database condition check failed'
        });
    }
    if (error.name === 'ValidationException') {
        return createResponse(400, {
            code: 'VALIDATION_ERROR',
            message: 'Invalid data format or missing required fields'
        });
    }
    if (error.name === 'ResourceNotFoundException') {
        return createResponse(404, {
            code: 'RESOURCE_NOT_FOUND',
            message: 'The requested resource was not found'
        });
    }
    if (error.name === 'TransactionCanceledException') {
        return createResponse(409, {
            code: 'TRANSACTION_CANCELED',
            message: 'Database transaction was canceled'
        });
    }
    if (error.name === 'ProvisionedThroughputExceededException') {
        return createResponse(429, {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        });
    }

    // Check for AWS SDK errors
    if (error.name === 'ServiceError' || error.$metadata?.httpStatusCode) {
        return createResponse(500, {
            code: 'AWS_SERVICE_ERROR',
            message: 'AWS service error occurred',
            details: error.message
        });
    }

    // Authentication specific errors
    if (error.message?.toLowerCase().includes('unauthorized')) {
        return createResponse(401, {
            code: 'UNAUTHORIZED',
            message: 'Authentication required or failed'
        });
    }
    if (error.message?.toLowerCase().includes('forbidden')) {
        return createResponse(403, {
            code: 'FORBIDDEN',
            message: 'Access denied to requested resource'
        });
    }

    // Generic error handler with specific codes
    return createResponse(500, {
        code: error.code || 'INTERNAL_SERVER_ERROR', // Changed from 'UNKNOWN'
        message: error.message || 'An unexpected error occurred',
        error: error.message,
        details: {
            context,
            errorName: error.name,
            errorCode: error.code,
            stack: error.stack
        }
    });
}
function sanitizeOrderNumber(orderNumber) {
    orderNumber = String(orderNumber);
    orderNumber = orderNumber.trim();
    if (orderNumber === '0') {
        throw new Error('Order number cannot be zero');
    }
    const MAX_LENGTH = 50;
    if (orderNumber.length > MAX_LENGTH) {
        throw new Error(`Order number exceeds maximum length of ${MAX_LENGTH} characters`);
    }
    const validPattern = /^[a-zA-Z0-9-_.]+$/;
    if (!validPattern.test(orderNumber)) {
        throw new Error('Order number contains invalid characters. Only alphanumeric characters, hyphens, underscores, and periods are allowed.');
    }
    return orderNumber;
}

async function handleUpdateDistributor(body) {
    try {
        if (!body.distributorId) {
            return createResponse(400, {
                code: 'MISSING_DISTRIBUTOR_ID',
                message: 'Distributor ID is required'
            });
        }

        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};

        // Map of fields that can be updated
        const updatableFields = {
            email: 'Email',
            distributorName: 'DistributorName',
            companyName: 'CompanyName',
            status: 'Status',
            username: 'Username'
        };

        // Build update expression for each field that has a value
        Object.entries(updatableFields).forEach(([key, dbField]) => {
            if (body[key] !== undefined) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = dbField;
                expressionAttributeValues[`:${key}`] = body[key];
            }
        });

        if (updateExpressions.length === 0) {
            return createResponse(400, { message: 'No fields to update' });
        }

        // If email is being updated, check for uniqueness
        if (body.email) {
            const existingEmailCheck = await ddbDocClient.send(new QueryCommand({
                TableName: 'Distributors',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'Email = :email',
                ExpressionAttributeValues: {
                    ':email': body.email
                }
            }));

            if (existingEmailCheck.Items?.length > 0 &&
                existingEmailCheck.Items[0].DistributorId !== body.distributorId) {
                return createResponse(400, { message: 'Email already registered to another distributor' });
            }
        }

        // Update the distributor
        await ddbDocClient.send(new UpdateCommand({
            TableName: 'Distributors',
            Key: {
                DistributorId: body.distributorId
            },
            UpdateExpression: 'SET ' + updateExpressions.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));

        return createResponse(200, {
            message: 'Distributor updated successfully',
            distributorId: body.distributorId
        });
    } catch (error) {
        console.error('Error updating distributor:', error);
        return createResponse(500, { message: 'Error updating distributor', error: error.message });
    }
}

async function handleInsertOrder(body) {
    console.log('Processing insert-order request');
    try {
        if (!body.orderNumber) {
            return createResponse(400, { message: 'Order number is required' });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, { message: sanitizationError.message });
        }

        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'IncomingOrders',
            FilterExpression: 'OrderNumber = :orderNumber',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            console.log('Order number already exists:', sanitizedOrderNumber);
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists'
            });
        }

        console.log('Attempting to insert order:', sanitizedOrderNumber);
        await ddbDocClient.send(new PutCommand({
            TableName: 'IncomingOrders',
            Item: {
                OrderNumber: sanitizedOrderNumber,
                CreatedAt: new Date().toISOString(),
                Status: 'pending'
            }
        }));

        console.log('Order number inserted successfully:', sanitizedOrderNumber);
        return createResponse(200, {
            message: 'Order number inserted successfully',
            orderNumber: sanitizedOrderNumber,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error inserting order:', error);
        return createResponse(500, { message: 'Error inserting order', error: error.message });
    }
}

async function handleGenerateToken(body) {
    console.log('Generating new token');
    try {
        if (!body.linkType) {
            return createResponse(400, {
                code: 'MISSING_LINK_TYPE',
                message: 'Link type is required'
            });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const createdAt = new Date().toISOString();

        await ddbDocClient.send(new PutCommand({
            TableName: 'Tokens',
            Item: {
                Token: token,
                CreatedAt: createdAt,
                LinkType: body.linkType,
                Status: body.linkType === 'unique' ? 'pending' : 'active'
            }
        }));

        console.log('Token generated:', token);
        return createResponse(200, { token });
    } catch (error) {
        console.error('Error generating token:', error);
        return createResponse(500, { message: 'Error generating token', error: error.message });
    }
}

async function handleRegisterDistributor(body) {
    console.log('Processing distributor registration');
    try {
        if (!body.token || !body.username || !body.email || !body.password || !body.distributorName || !body.companyName) {
            return createResponse(400, { message: 'Missing required fields' });
        }

        // Check for existing email using the GSI
        const existingEmailCheck = await ddbDocClient.send(new QueryCommand({
            TableName: 'Distributors',
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'Email = :email',
            ExpressionAttributeValues: {
                ':email': body.email
            }
        }));

        if (existingEmailCheck.Items && existingEmailCheck.Items.length > 0) {
            return createResponse(400, { message: 'Email already registered' });
        }

        const tokenResult = await ddbDocClient.send(new GetCommand({
            TableName: 'Tokens',
            Key: { Token: body.token }
        }));

        if (!tokenResult.Item) {
            return createResponse(400, { message: 'Invalid token' });
        }

        if ((tokenResult.Item.LinkType === 'unique' && tokenResult.Item.Status !== 'pending') ||
            (tokenResult.Item.LinkType === 'generic' && tokenResult.Item.Status !== 'active')) {
            return createResponse(400, { message: 'Link is invalid or inactive. Please request a new registration link from administrator.' });
        }

        const distributorId = crypto.randomBytes(16).toString('hex');
        const linkType = tokenResult.Item.LinkType;
        const tokenCreatedAt = tokenResult.Item.CreatedAt;
        const registrationDate = new Date().toISOString();

        let sanitizedOrderNumber;
        let distributorStatus = linkType === 'unique' ? 'active' : 'pending';
        let orderMatchFound = false;

        if (linkType === 'generic' && body.orderNumber) {
            try {
                sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
            } catch (sanitizationError) {
                return createResponse(400, { message: sanitizationError.message });
            }

            const orderResult = await ddbDocClient.send(new GetCommand({
                TableName: 'IncomingOrders',
                Key: { OrderNumber: sanitizedOrderNumber }
            }));

            if (orderResult.Item &&
                (orderResult.Item.Status === 'pending' || !orderResult.Item.Status)) {
                orderMatchFound = true;
                distributorStatus = 'active';
            } else {
                const scanResult = await ddbDocClient.send(new ScanCommand({
                    TableName: 'Distributors',
                    FilterExpression: 'OrderNumber = :orderNumber',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitizedOrderNumber
                    }
                }));

                if (scanResult.Items && scanResult.Items.length > 0) {
                    return createResponse(400, { message: 'Order number already exists. Please use a different order number.' });
                }
            }
        }

        const distributorItem = {
            DistributorId: distributorId,
            Username: body.username,
            Email: body.email,
            Password: body.password, // Store plain password
            Token: body.token,
            DistributorName: body.distributorName,
            CompanyName: body.companyName,
            Role: 'Distributor',
            LinkType: linkType,
            TokenCreatedAt: tokenCreatedAt,
            RegistrationDate: registrationDate,
            Status: distributorStatus
        };

        if (sanitizedOrderNumber) {
            distributorItem.OrderNumber = sanitizedOrderNumber;
        }

        const transactItems = [{
            Put: {
                TableName: 'Distributors',
                Item: distributorItem,
                ConditionExpression: 'attribute_not_exists(Email)'
            }
        }];

        if (linkType === 'unique') {
            transactItems.push({
                Update: {
                    TableName: 'Tokens',
                    Key: { Token: body.token },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        if (orderMatchFound) {
            transactItems.push({
                Update: {
                    TableName: 'IncomingOrders',
                    Key: { OrderNumber: sanitizedOrderNumber },
                    UpdateExpression: 'SET #status = :statusValue',
                    ExpressionAttributeNames: { '#status': 'Status' },
                    ExpressionAttributeValues: { ':statusValue': 'used' }
                }
            });
        }

        await ddbDocClient.send(new TransactWriteCommand({
            TransactItems: transactItems
        }));

        // After the successful transaction that creates the distributor, add:
        const appsResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'Apps',
            FilterExpression: '#status = :activeStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':activeStatus': 'active' }
        }));

        if (appsResult.Items && appsResult.Items.length > 0) {
            const batchSize = 25; // DynamoDB limit
            const appAssignments = appsResult.Items.map(app => ({
                Put: {
                    TableName: 'DistributorApps',
                    Item: {
                        DistributorId: distributorId,
                        AppId: app.AppId,
                        CreatedAt: new Date().toISOString(),
                        Status: 'active',
                        CommissionRate: 0.3  // Default commission rate
                    }
                }
            }));

            // Process in batches due to DynamoDB limits
            for (let i = 0; i < appAssignments.length; i += batchSize) {
                const batch = appAssignments.slice(i, i + batchSize);
                await ddbDocClient.send(new TransactWriteCommand({
                    TransactItems: batch
                }));
            }
        }

        console.log('Successfully registered distributor');
        return createResponse(200, { message: 'Distributor registered successfully' });
    } catch (error) {
        console.error('Error registering distributor:', error);
        if (error.name === 'TransactionCanceledException') {
            if (error.message.includes('ConditionalCheckFailed')) {
                return createResponse(409, { message: 'Email already registered' });
            }
            return createResponse(409, { message: 'Registration failed due to a conflict. Please try again.' });
        }
        return createResponse(500, { message: 'Error registering distributor', error: error.message });
    }
}
async function handleSyncOrdersAndDistributors() {
    try {
        const pendingOrdersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'IncomingOrders',
            FilterExpression: 'attribute_not_exists(#status) OR #status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const pendingDistributorsResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'Distributors',
            FilterExpression: '#status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const transactItems = [];

        for (const order of pendingOrdersResult.Items) {
            const matchingDistributor = pendingDistributorsResult.Items.find(
                distributor => distributor.OrderNumber === order.OrderNumber
            );

            if (matchingDistributor) {
                transactItems.push({
                    Update: {
                        TableName: 'IncomingOrders',
                        Key: { OrderNumber: order.OrderNumber },
                        UpdateExpression: 'SET #status = :usedStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':usedStatus': 'used' }
                    }
                });

                transactItems.push({
                    Update: {
                        TableName: 'Distributors',
                        Key: { DistributorId: matchingDistributor.DistributorId },
                        UpdateExpression: 'SET #status = :activeStatus',
                        ExpressionAttributeNames: { '#status': 'Status' },
                        ExpressionAttributeValues: { ':activeStatus': 'active' }
                    }
                });

                if (transactItems.length === 25) {  // DynamoDB limit of 25 items per transaction
                    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
                    transactItems.length = 0;  // Clear the array
                }
            }
        }

        if (transactItems.length > 0) {
            await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        }

        return createResponse(200, { message: `Sync completed. Updated ${transactItems.length / 2} pairs.` });
    } catch (error) {
        console.error('Error syncing orders and distributors:', error);
        return createResponse(500, { message: 'Error syncing orders and distributors', error: error.message });
    }
}
async function handleFetchIncomingOrders(event) {
    try {
        console.log('Fetching incoming orders');
        const { orderFilter, dateFilter, statusFilter } = event.queryStringParameters || {};

        let filterExpression = [];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (dateFilter) {
            filterExpression.push('begins_with(CreatedAt, :dateFilter)');
            expressionAttributeValues[':dateFilter'] = dateFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        const scanParams = {
            TableName: 'IncomingOrders',
            FilterExpression: filterExpression.length > 0 ? filterExpression.join(' AND ') : undefined,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('Incoming orders fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching incoming orders:', error);
        return createResponse(500, { message: 'Error fetching incoming orders', error: error.message });
    }
}
async function handleFetchPendingDistributors(event) {
    try {
        console.log('Fetching distributors');
        const { nameFilter, emailFilter, orderFilter, statusFilter, linkTypeFilter } = event.queryStringParameters || {};

        let filterExpression = [];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        if (nameFilter) {
            filterExpression.push('contains(#distributorName, :nameFilter)');
            expressionAttributeNames['#distributorName'] = 'DistributorName';
            expressionAttributeValues[':nameFilter'] = nameFilter;
        }

        if (emailFilter) {
            filterExpression.push('contains(Email, :emailFilter)');
            expressionAttributeValues[':emailFilter'] = emailFilter;
        }

        if (orderFilter) {
            filterExpression.push('contains(OrderNumber, :orderFilter)');
            expressionAttributeValues[':orderFilter'] = orderFilter;
        }

        if (statusFilter) {
            filterExpression.push('#status = :statusFilter');
            expressionAttributeNames['#status'] = 'Status';
            expressionAttributeValues[':statusFilter'] = statusFilter;
        }

        if (linkTypeFilter) {
            filterExpression.push('LinkType = :linkTypeFilter');
            expressionAttributeValues[':linkTypeFilter'] = linkTypeFilter;
        }

        const scanParams = {
            TableName: 'Distributors',
            FilterExpression: filterExpression.length > 0 ? filterExpression.join(' AND ') : undefined,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined
        };

        const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));

        console.log('Distributors fetched:', scanResult.Items.length);
        return createResponse(200, scanResult.Items);
    } catch (error) {
        console.error('Error fetching distributors:', error);
        return createResponse(500, { message: 'Error fetching distributors', error: error.message });
    }
}

async function handleBulkInsertOrders(body) {
    console.log('Processing bulk insert orders request');
    try {
        if (!body.orders || !Array.isArray(body.orders) || body.orders.length === 0) {
            return createResponse(400, { message: 'Invalid or empty orders array' });
        }

        // Step 1: Sanitize and deduplicate order numbers
        const sanitizedOrders = body.orders.map(order => {
            try {
                return {
                    ...order,
                    orderNumber: sanitizeOrderNumber(order.orderNumber)
                };
            } catch (sanitizationError) {
                console.error('Error sanitizing order number:', sanitizationError);
                return null;
            }
        }).filter(order => order !== null);

        const uniqueOrders = Array.from(new Set(sanitizedOrders.map(o => o.orderNumber)))
            .map(orderNumber => sanitizedOrders.find(o => o.orderNumber === orderNumber));

        // Step 2: Check for existing order numbers
        const existingOrders = await checkExistingOrders(uniqueOrders.map(o => o.orderNumber));

        // Step 3: Filter out existing orders
        const newOrders = uniqueOrders.filter(order => !existingOrders.includes(order.orderNumber));

        // Step 4: Insert new orders in batches
        const batchSize = 25; // DynamoDB allows up to 25 items per batch write
        const batches = [];

        for (let i = 0; i < newOrders.length; i += batchSize) {
            const batch = newOrders.slice(i, i + batchSize);
            const putRequests = batch.map(order => ({
                PutRequest: {
                    Item: {
                        OrderNumber: order.orderNumber,
                        CreatedAt: order.createdAt,
                        Status: 'pending' // Default status
                    }
                }
            }));

            if (putRequests.length > 0) {
                batches.push(
                    ddbDocClient.send(new BatchWriteCommand({
                        RequestItems: {
                            'IncomingOrders': putRequests
                        }
                    }))
                );
            }
        }

        await Promise.all(batches);

        console.log(`Successfully inserted ${newOrders.length} new orders. ${existingOrders.length} duplicates were skipped.`);
        return createResponse(200, {
            message: `Successfully inserted ${newOrders.length} new orders. ${existingOrders.length} duplicates were skipped.`,
            insertedCount: newOrders.length,
            skippedCount: existingOrders.length
        });
    } catch (error) {
        console.error('Error bulk inserting orders:', error);
        return createResponse(500, { message: 'Error bulk inserting orders', error: error.message });
    }
}

async function handleGetPublicSubappInfo(event) {
    console.log("getPublicSubappInfo called with:", {
        body: JSON.parse(event.body || '{}')
    });

    try {
        const body = JSON.parse(event.body || '{}');
        const { appId, subappId } = body;

        if (!appId || !subappId) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'App ID and SubApp ID are required'
            });
        }

        // Get the subapp metadata from the mapping table
        const result = await ddbDocClient.send(new GetCommand({
            TableName: 'AppSubAppMapping',
            Key: {
                AppId: appId,
                SubAppId: subappId
            }
        }));

        if (!result.Item) {
            return createResponse(404, {
                code: 'SUBAPP_NOT_FOUND',
                message: 'SubApp not found'
            });
        }

        // Return the subapp information
        return createResponse(200, {
            status: true,
            subappName: result.Item.SubAppName || result.Item.subappName,
            description: result.Item.Description || result.Item.description
        });
    } catch (error) {
        console.error('Error fetching public subapp info:', error);
        return handleLambdaError(error, 'handleGetPublicSubappInfo');
    }
}

async function checkExistingOrders(orderNumbers) {
    const existingOrders = [];
    const batchSize = 100; // DynamoDB allows up to 100 items per batch get

    for (let i = 0; i < orderNumbers.length; i += batchSize) {
        const batch = orderNumbers.slice(i, i + batchSize);
        const keys = batch.map(orderNumber => ({ OrderNumber: orderNumber }));

        const result = await ddbDocClient.send(new BatchGetCommand({
            RequestItems: {
                'IncomingOrders': {
                    Keys: keys
                }
            }
        }));

        existingOrders.push(...result.Responses.IncomingOrders.map(item => item.OrderNumber));
    }

    return existingOrders;
}
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            ...headers,
            // Add only new headers that weren't in the original headers constant
            'Surrogate-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body),
    };
}