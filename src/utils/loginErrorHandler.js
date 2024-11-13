export const handleLoginError = (error, setPermanentMessage) => {
    const errorCode = error.response?.data?.code;
    const errorMsg = error.response?.data?.message || 'Failed to login. Please try again.';

    switch (errorCode) {
        case 'INVALID_CREDENTIALS':
            setPermanentMessage({
                type: 'error',
                content: 'Invalid email or password'
            });
            break;

        case 'ACCOUNT_INACTIVE':
            setPermanentMessage({
                type: 'error',
                content: 'Your account is not active. Please contact support.'
            });
            break;

        case 'MISSING_CREDENTIALS':
            setPermanentMessage({
                type: 'error',
                content: 'Please enter both email and password.'
            });
            break;

        case 'INVALID_TOKEN':
        case 'TOKEN_EXPIRED':
            setPermanentMessage({
                type: 'error',
                content: 'Your session has expired. Please log in again.'
            });
            break;

        case 'RATE_LIMIT_EXCEEDED':
            setPermanentMessage({
                type: 'error',
                content: 'Too many login attempts. Please try again later.'
            });
            break;

        case 'VALIDATION_ERROR':
            setPermanentMessage({
                type: 'error',
                content: 'Please check your email format and password length.'
            });
            break;

        case 'RESOURCE_NOT_FOUND':
            setPermanentMessage({
                type: 'error',
                content: 'Account not found. Please check your email or register.'
            });
            break;

        case 'CONDITION_FAILED':
        case 'TRANSACTION_CANCELED':
            setPermanentMessage({
                type: 'error',
                content: 'Login failed due to a database error. Please try again.'
            });
            break;

        case 'DATABASE_ERROR':
            setPermanentMessage({
                type: 'error',
                content: 'Unable to access user information. Please try again later.'
            });
            break;

        case 'DATA_INTEGRITY_ERROR':
            setPermanentMessage({
                type: 'error',
                content: 'Account data issue detected. Please contact support.'
            });
            break;

        case 'AWS_SERVICE_ERROR':
            setPermanentMessage({
                type: 'error',
                content: 'Service temporarily unavailable. Please try again later.'
            });
            break;

        default:
            setPermanentMessage({
                type: 'error',
                content: `${errorMsg} (Code: ${errorCode || 'INTERNAL_SERVER_ERROR'})`
            });
    }
};