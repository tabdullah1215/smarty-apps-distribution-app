const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand, QueryCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

async function handleUpdateAppUser(body) {
    try {
        if (!body.appId || !body.email) {
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'App ID and email are required'
            });
        }

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

async function handleGetPendingAppUsers(event) {
    try {
        const decodedToken = await verifyAuthToken(event);
        if (!decodedToken) {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required to access this resource'
            });
        }

        console.log('Fetching pending app users');
        const { appFilter, emailFilter, orderFilter, dateFilter, statusFilter, linkTypeFilter } = event.queryStringParameters || {};

        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': decodedToken.sub
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

        const decodedToken = await verifyAuthToken(event);
        console.log('Decoded token:', decodedToken);

        if (!decodedToken || decodedToken.role !== 'Distributor') {
            console.log('Auth failed - Token:', decodedToken);
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            });
        }

        // Get apps assigned to this distributor
        const distributorAppsResult = await ddbDocClient.send(new QueryCommand({
            TableName: 'DistributorApps',
            KeyConditionExpression: 'DistributorId = :distributorId',
            ExpressionAttributeValues: {
                ':distributorId': decodedToken.sub
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

async function handleGenerateAppPurchaseToken(body, event) { // Add event parameter
    console.log('Generating new app purchase token', {
        receivedBody: body,
        distributorId: body.distributorId,
        hasAuth: !!event.headers.Authorization
    });

    try {
        if (!body.linkType || !body.appId || !body.distributorId) {
            console.log('Missing required fields:', {
                hasLinkType: !!body.linkType,
                hasAppId: !!body.appId,
                hasDistributorId: !!body.distributorId
            });
            return createResponse(400, {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Link type, app ID, and distributor ID are required for purchase token generation'
            });
        }

        // Verify auth using the same method as other endpoints
        const decodedToken = await verifyAuthToken(event);
        console.log('Token verification result:', {
            hasToken: !!decodedToken,
            tokenRole: decodedToken?.role,
            tokenSub: decodedToken?.sub
        });

        if (!decodedToken || decodedToken.role !== 'Distributor' || decodedToken.sub !== body.distributorId) {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Valid distributor authentication required'
            });
        }

        // Rest of the function remains the same
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
            distributorId: body.distributorId,
            linkType: body.linkType,
            status: tokenItem.Status
        });

        return createResponse(200, {
            token,
            expiresAt,
            status: tokenItem.Status,
            appDomain: appResult.Item.AppDomain
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

        // Lookup user by AppId and Email composite key
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

        if (userResult.Item.Status !== 'active') {
            return createResponse(403, {
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is not active'
            });
        }

        // Generate JWT for app user
        const token = jwt.sign(
            {
                sub: userResult.Item.Email,
                appId: body.appId,
                status: userResult.Item.Status
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRATION }
        );

        return createResponse(200, {
            token,
            user: {
                email: userResult.Item.Email,
                status: userResult.Item.Status
            }
        });
    } catch (error) {
        return handleLambdaError(error, 'handleAppLogin');
    }
}

async function handleFetchAppPurchaseOrders(event) {
    try {
        const decodedToken = await verifyAuthToken(event);
        if (!decodedToken) {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required to access this resource'
            });
        }

        console.log('Fetching app purchase orders');
        const { orderFilter, dateFilter, statusFilter } = event.queryStringParameters || {};

        let filterExpression = ['DistributorId = :distributorId'];
        let expressionAttributeNames = {};
        let expressionAttributeValues = {
            ':distributorId': decodedToken.sub  // Add this line
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
            return createResponse(400, { message: 'Order number is required' });
        }

        const decodedToken = await verifyAuthToken(event);
        if (!decodedToken || decodedToken.role !== 'Distributor') {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Valid distributor authentication required'
            });
        }

        let sanitizedOrderNumber;
        try {
            sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
        } catch (sanitizationError) {
            return createResponse(400, { message: sanitizationError.message });
        }

        const scanResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: 'OrderNumber = :orderNumber',
            ExpressionAttributeValues: {
                ':orderNumber': sanitizedOrderNumber
            }
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            return createResponse(409, {
                code: 'DUPLICATE_ORDER',
                message: 'Order number already exists'
            });
        }

        await ddbDocClient.send(new PutCommand({
            TableName: 'AppPurchaseOrders',
            Item: {
                OrderNumber: sanitizedOrderNumber,
                CreatedAt: new Date().toISOString(),
                Status: 'pending',
                DistributorId: decodedToken.sub
            }
        }));

        return createResponse(200, {
            message: 'Order number inserted successfully',
            orderNumber: sanitizedOrderNumber,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleLambdaError(error, 'handleInsertAppPurchaseOrder');
    }
}

async function handleSyncAppUsers() {
    try {
        const pendingOrdersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppPurchaseOrders',
            FilterExpression: 'attribute_not_exists(#status) OR #status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const pendingUsersResult = await ddbDocClient.send(new ScanCommand({
            TableName: 'AppUsers',
            FilterExpression: '#status = :pendingStatus',
            ExpressionAttributeNames: { '#status': 'Status' },
            ExpressionAttributeValues: { ':pendingStatus': 'pending' }
        }));

        const transactItems = [];

        for (const order of pendingOrdersResult.Items) {
            const matchingUser = pendingUsersResult.Items.find(
                user => user.OrderNumber === order.OrderNumber
            );

            if (matchingUser) {
                transactItems.push({
                    Update: {
                        TableName: 'AppPurchaseOrders',
                        Key: { OrderNumber: order.OrderNumber },
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

                if (transactItems.length === 25) {
                    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
                    transactItems.length = 0;
                }
            }
        }

        if (transactItems.length > 0) {
            await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
        }

        return createResponse(200, {
            message: `Sync completed. Updated ${transactItems.length / 2} pairs.`
        });

    } catch (error) {
        console.error('Error syncing app users:', error);
        return handleLambdaError(error, 'handleSyncAppUsers');
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
                message: 'Purchase token is invalid or has already been used'
            });
        }

        const purchaseDate = new Date().toISOString();
        let purchaseStatus = tokenResult.Item.LinkType === 'unique' ? 'active' : 'pending';
        let orderMatchFound = false;

        // For generic links, verify order number
        if (tokenResult.Item.LinkType === 'generic' && body.orderNumber) {
            try {
                const sanitizedOrderNumber = sanitizeOrderNumber(body.orderNumber);
                const orderResult = await ddbDocClient.send(new GetCommand({
                    TableName: 'AppPurchaseOrders',
                    Key: { OrderNumber: sanitizedOrderNumber }
                }));

                if (orderResult.Item &&
                    (orderResult.Item.Status === 'pending' || !orderResult.Item.Status)) {
                    orderMatchFound = true;
                    purchaseStatus = 'active';
                } else {
                    purchaseStatus = 'pending';  // Set pending if no order match
                }

                // Check if order number already used for another user
                const existingUserScan = await ddbDocClient.send(new ScanCommand({
                    TableName: 'AppUsers',
                    FilterExpression: 'OrderNumber = :orderNumber',
                    ExpressionAttributeValues: {
                        ':orderNumber': sanitizedOrderNumber
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
                        DistributorId: tokenResult.Item.DistributorId,  // Also need to store this
                        LinkType: tokenResult.Item.LinkType  // And this for filtering
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

        // Update order status if order matched
        if (orderMatchFound) {
            transactItems.push({
                Update: {
                    TableName: 'AppPurchaseOrders',
                    Key: { OrderNumber: body.orderNumber },
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
            status: purchaseStatus
        });

    } catch (error) {
        console.error('Error processing app purchase:', error);
        if (error.name === 'TransactionCanceledException') {
            if (error.message.includes('ConditionalCheckFailed')) {
                return createResponse(409, {
                    code: 'EMAIL_EXISTS',
                    message: 'Email already registered for this app'
                });
            }
        }
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

    try {
        const action = event.queryStringParameters?.action;

        if (!action) {
            return createResponse(400, {
                code: 'MISSING_ACTION',     // Added error code
                message: 'Missing action parameter'
            });
        }

        let body = {};
        if (event.httpMethod === 'POST') {
            try {
                body = JSON.parse(event.body || '{}');
            } catch (error) {
                return createResponse(400, {
                    code: 'INVALID_JSON',   // Added error code
                    message: 'Invalid JSON in request body'
                });
            }
            console.log('Parsed body:', JSON.stringify(body, null, 2));
        }

        switch (action) {
            case 'verifyCredentials':
                return await handleVerifyCredentials(body);
            case 'verifyToken':
                return await handleVerifyToken(event);
            case 'insertOrder':
                return await handleInsertOrder(body);
            case 'generateToken':
                return await handleGenerateToken(body);
            case 'registerDistributor':
                return await handleRegisterDistributor(body);
            case 'syncOrdersAndDistributors':
                return await handleSyncOrdersAndDistributors();
            case 'getIncomingOrders':
                return await handleFetchIncomingOrders(event);
            case 'getDistributors':
                return await handleFetchPendingDistributors(event);
            case 'bulkInsertOrders':
                return await handleBulkInsertOrders(body);
            case 'updateDistributor':
                return await handleUpdateDistributor(body);
            case 'generatePurchaseToken':
                return await handleGenerateAppPurchaseToken(body, event);
            case 'verifyAppPurchase':
                return await handleVerifyAppPurchase(body);
            case 'fetchAvailableApps':
                return await handleFetchAvailableApps(event);
            case 'appLogin':
                return await handleAppLogin(body);
            case 'syncAppUsers':
                return await handleSyncAppUsers();
            case 'insertAppPurchaseOrder':
                return await handleInsertAppPurchaseOrder(body, event);
            case 'getAppPurchaseOrders':
                return await handleFetchAppPurchaseOrders(event);
            case 'getPendingAppUsers':
                return await handleGetPendingAppUsers(event);
            case 'updateAppUser':
                return await handleUpdateAppUser(body);
            default:
                return createResponse(400, {
                    code: 'INVALID_ACTION', // Added error code
                    message: 'Invalid action'
                });
        }
    } catch (error) {
        // Use the new error handling utility
        return handleLambdaError({
            ...error,
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: error.message || 'An unexpected error occurred'
        }, 'handler');
    }
};

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

        const decodedToken = await verifyAuthToken(event);
        if (!decodedToken) {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required to access this resource'
            });
        }

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

        const decodedToken = await verifyAuthToken(event);
        if (!decodedToken) {
            return createResponse(401, {
                code: 'UNAUTHORIZED',
                message: 'Authentication required to access this resource'
            });
        }

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