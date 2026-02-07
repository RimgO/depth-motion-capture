
export const calculateAllMetrics = ({ landmarks, currentTime, lastProcessTime, vrm }) => {
    if (!landmarks) return { confidence: 0, landmarks: 0, latency: 0, flux: 0, rigging: false };

    const avgConfidence = landmarks.reduce((acc, curr) => acc + (curr.visibility || 0), 0) / landmarks.length;

    return {
        confidence: Math.round(avgConfidence * 100),
        landmarks: landmarks.length,
        latency: currentTime - lastProcessTime,
        flux: Math.round((landmarks.length * 1000) / (currentTime - lastProcessTime || 1)),
        rigging: vrm && (Date.now() - (vrm._lastRigTime || 0) < 500)
    };
};
