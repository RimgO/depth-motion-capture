import * as Kalidokit from 'kalidokit';

/**
 * Calculates the full body pose (arms, legs, torso) using Kalidokit.
 * @param {Object} results - The MediaPipe results object.
 * @param {Object} options - Optional capture settings or video dimensions.
 * @returns {Object|null} - The rigged pose object or null if failed.
 */
export const calculatePose = (results, options = {}) => {
    const { poseLandmarks, poseWorldLandmarks, za } = results;
    const worldLandmarks = poseWorldLandmarks || za;

    if (!worldLandmarks || !poseLandmarks) return null;

    try {
        const rig = Kalidokit.Pose.solve(worldLandmarks, poseLandmarks, {
            runtime: 'mediapipe',
            imageSize: options.imageSize || { width: 640, height: 480 }
        });
        return rig;
    } catch (error) {
        console.error("Pose Calculation Error:", error);
        return null;
    }
};

export const applyTemporalSmoothing = (currentPose, previousPose, smoothFactor = 0.5) => {
    if (!previousPose) return currentPose;

    const smoothedPose = {};

    Object.keys(currentPose).forEach(key => {
        const curr = currentPose[key];
        const prev = previousPose[key];

        // If it's a bone rotation object (x, y, z, order)
        if (curr && typeof curr === 'object' && 'x' in curr && prev) {
            smoothedPose[key] = {
                x: curr.x * (1 - smoothFactor) + prev.x * smoothFactor,
                y: curr.y * (1 - smoothFactor) + prev.y * smoothFactor,
                z: curr.z * (1 - smoothFactor) + prev.z * smoothFactor,
                rotationOrder: curr.rotationOrder || 'XYZ'
            };
        } else {
            // Direct copy for non-interpolatable or missing prev data
            smoothedPose[key] = curr;
        }
    });

    return smoothedPose;
};

// Legacy placeholders to prevent crashes if import is mixed, 
// but we will update MotionCapturer to use calculatePose.
export const calculateArmRotations = () => ({});
export const calculateBodyRotations = () => ({});
export const calculateLegRotations = () => ({});
export const mergeRiggedPose = (...args) => Object.assign({}, ...args);
