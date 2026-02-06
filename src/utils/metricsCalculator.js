/**
 * Calculate average confidence from landmarks
 * @param {Array} landmarks - Array of landmarks with visibility property
 * @returns {number} Average confidence (0-100)
 */
export function calculateConfidence(landmarks) {
    if (!landmarks || landmarks.length === 0) return 0;
    
    const avgConfidence = landmarks.reduce((acc, curr) => {
        return acc + (curr.visibility || 0);
    }, 0) / landmarks.length;
    
    return Math.round(avgConfidence * 100);
}

/**
 * Calculate processing latency
 * @param {number} currentTime - Current timestamp
 * @param {number} lastProcessTime - Last process timestamp
 * @returns {number} Latency in milliseconds
 */
export function calculateLatency(currentTime, lastProcessTime) {
    return currentTime - lastProcessTime;
}

/**
 * Calculate flux (throughput) metric
 * @param {number} landmarkCount - Number of landmarks processed
 * @param {number} latency - Processing latency in milliseconds
 * @returns {number} Flux value (landmarks per second)
 */
export function calculateFlux(landmarkCount, latency) {
    if (latency === 0) return 0;
    return Math.round((landmarkCount * 1000) / latency);
}

/**
 * Check if VRM is actively rigging
 * @param {Object} vrm - VRM instance
 * @param {number} currentTime - Current timestamp
 * @param {number} riggingWindow - Time window in milliseconds to consider active
 * @returns {boolean} True if VRM was rigged recently
 */
export function isVrmRigging(vrm, currentTime, riggingWindow = 500) {
    if (!vrm || !vrm._lastRigTime) return false;
    return (currentTime - vrm._lastRigTime) < riggingWindow;
}

/**
 * Calculate all metrics at once
 * @param {Object} params - Parameters object
 * @param {Array} params.landmarks - Pose landmarks
 * @param {number} params.currentTime - Current timestamp
 * @param {number} params.lastProcessTime - Last process timestamp  
 * @param {Object} params.vrm - VRM instance
 * @returns {Object} Metrics object with confidence, landmarks, latency, flux, rigging
 */
export function calculateAllMetrics({ landmarks, currentTime, lastProcessTime, vrm }) {
    const confidence = calculateConfidence(landmarks);
    const latency = calculateLatency(currentTime, lastProcessTime);
    const flux = calculateFlux(landmarks.length, latency);
    const rigging = isVrmRigging(vrm, currentTime);
    
    return {
        confidence,
        landmarks: landmarks.length,
        latency,
        flux,
        rigging
    };
}
