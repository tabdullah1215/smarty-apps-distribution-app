// utils/withDelay.js

/**
 * Ensures an operation takes at least the minimum specified time
 * @param {Function} operation - Async operation to perform
 * @param {number} minimumDelay - Minimum time in milliseconds
 * @returns {Promise<*>} Result of the operation
 */
export const withMinimumDelay = async (operation, minimumDelay = 500) => {
    const startTime = Date.now();
    const result = await operation();
    const elapsedTime = Date.now() - startTime;

    if (elapsedTime < minimumDelay) {
        await new Promise(resolve => setTimeout(resolve, minimumDelay - elapsedTime));
    }

    return result;
};