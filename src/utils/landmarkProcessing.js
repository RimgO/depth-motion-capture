import { POSE_LANDMARKS, DEPTH_ESTIMATION, COORDINATES } from '../constants/landmarks.js';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';

/**
 * Low-Pass Filter for smoothing landmark jitter
 */
export class LowPassFilter {
    constructor(smoothing = 0.3) {
        this.smoothing = smoothing;
        this.initialized = false;
        this.hatXPrev = null;
    }

    filter(value) {
        if (!this.initialized) {
            this.initialized = true;
            this.hatXPrev = value;
            return value;
        }
        
        const alpha = this.smoothing;
        const hatX = {};
        for (const key in value) {
            if (typeof value[key] === 'number' && this.hatXPrev[key] !== undefined) {
                hatX[key] = alpha * this.hatXPrev[key] + (1 - alpha) * value[key];
            } else {
                hatX[key] = value[key];
            }
        }
        this.hatXPrev = hatX;
        return hatX;
    }

    reset() {
        this.initialized = false;
        this.hatXPrev = null;
    }
}

/**
 * Draw 2D pose overlay on canvas
 * @param {CanvasRenderingContext2D} canvasCtx - Canvas context
 * @param {Object} results - MediaPipe Holistic results
 */
export function draw2DOverlay(overlayRef, results) {
    if (!overlayRef.current || !results.poseLandmarks) return;
    
    const canvasCtx = overlayRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    // Draw pose
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ff0077', lineWidth: 1, radius: 3 });

    // Draw hands
    if (results.leftHandLandmarks) {
        drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#00ff00', lineWidth: 1 });
        drawLandmarks(canvasCtx, results.leftHandLandmarks, { color: '#00ff00', lineWidth: 1, radius: 2 });
    }
    if (results.rightHandLandmarks) {
        drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#ff00ff', lineWidth: 1 });
        drawLandmarks(canvasCtx, results.rightHandLandmarks, { color: '#ff00ff', lineWidth: 1, radius: 2 });
    }

    canvasCtx.restore();
}

/**
 * Generate pseudo-3D world landmarks from 2D landmarks using biomechanical constraints
 * @param {Array} landmarks - 2D pose landmarks from MediaPipe
 * @param {Array} landmarkFilters - Array of LowPassFilter instances
 * @returns {Array} 3D world landmarks with x, y, z, visibility properties
 */
export function generate3DLandmarks(landmarks, landmarkFilters) {
    // Helper functions
    const dist2D = (a, b) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
    const vec2D = (from, to) => ({ x: to.x - from.x, y: to.y - from.y });
    const length2D = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
    
    // Calculate torso center and orientation
    const shoulderCenter = {
        x: (landmarks[POSE_LANDMARKS.LEFT_SHOULDER].x + landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2,
        y: (landmarks[POSE_LANDMARKS.LEFT_SHOULDER].y + landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2
    };
    const hipCenter = {
        x: (landmarks[POSE_LANDMARKS.LEFT_HIP].x + landmarks[POSE_LANDMARKS.RIGHT_HIP].x) / 2,
        y: (landmarks[POSE_LANDMARKS.LEFT_HIP].y + landmarks[POSE_LANDMARKS.RIGHT_HIP].y) / 2
    };
    
    let worldLandmarks = landmarks.map((lm, index) => {
        let depthEstimate = 0;
        
        // Arm depth estimation with improved biomechanics
        if (index === POSE_LANDMARKS.LEFT_WRIST || index === POSE_LANDMARKS.RIGHT_WRIST) {
            const isLeft = index === POSE_LANDMARKS.LEFT_WRIST;
            const shoulder = landmarks[isLeft ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER];
            const elbow = landmarks[isLeft ? POSE_LANDMARKS.LEFT_ELBOW : POSE_LANDMARKS.RIGHT_ELBOW];
            
            // Vector from shoulder to elbow
            const shoulderToElbow = vec2D(shoulder, elbow);
            const elbowToWrist = vec2D(elbow, lm);
            
            // Arm raised vertically = forward projection
            const verticalComponent = shoulder.y - lm.y; // Positive = hand above shoulder
            depthEstimate += verticalComponent * DEPTH_ESTIMATION.ARM_VERTICAL_DEPTH;
            
            // Lateral extension = forward/back based on side
            const lateralDistance = Math.abs(lm.x - shoulderCenter.x);
            const centerToShoulder = shoulder.x - shoulderCenter.x;
            const centerToWrist = lm.x - shoulderCenter.x;
            // If wrist is further from center than shoulder, it's extending outward
            if (Math.sign(centerToWrist) === Math.sign(centerToShoulder) && 
                Math.abs(centerToWrist) > Math.abs(centerToShoulder)) {
                depthEstimate += lateralDistance * DEPTH_ESTIMATION.ARM_LATERAL_DEPTH;
            }
            
            // Elbow angle: more bent = more forward
            const upperArmLen = length2D(shoulderToElbow);
            const forearmLen = length2D(elbowToWrist);
            const shoulderToWristDist = dist2D(shoulder, lm);
            if (upperArmLen + forearmLen > 0) {
                const armExtension = shoulderToWristDist / (upperArmLen + forearmLen);
                // Full extension = 1.0, fully bent = 0.0
                depthEstimate += (1 - armExtension) * DEPTH_ESTIMATION.ARM_BEND_DEPTH;
            }
            
            // Forward reach indicator (wrist ahead of shoulder in X)
            if (isLeft && lm.x > shoulder.x || !isLeft && lm.x < shoulder.x) {
                depthEstimate += Math.abs(lm.x - shoulder.x) * DEPTH_ESTIMATION.ARM_FORWARD_REACH;
            }
        }
        // Elbow depth
        else if (index === POSE_LANDMARKS.LEFT_ELBOW || index === POSE_LANDMARKS.RIGHT_ELBOW) {
            const isLeft = index === POSE_LANDMARKS.LEFT_ELBOW;
            const shoulder = landmarks[isLeft ? POSE_LANDMARKS.LEFT_SHOULDER : POSE_LANDMARKS.RIGHT_SHOULDER];
            const wrist = landmarks[isLeft ? POSE_LANDMARKS.LEFT_WRIST : POSE_LANDMARKS.RIGHT_WRIST];
            
            // Raised elbow = forward
            const elbowHeight = shoulder.y - lm.y;
            depthEstimate = elbowHeight * DEPTH_ESTIMATION.ELBOW_HEIGHT_DEPTH;
            
            // Lateral position
            const lateralDist = Math.abs(lm.x - shoulder.x);
            depthEstimate += lateralDist * DEPTH_ESTIMATION.ELBOW_LATERAL_DEPTH;
            
            // If elbow is between shoulder and wrist vertically
            if (lm.y > shoulder.y && lm.y < wrist.y) {
                depthEstimate += DEPTH_ESTIMATION.ELBOW_MID_DEPTH; // Slightly forward
            }
        }
        // Shoulders - reference depth
        else if (index === POSE_LANDMARKS.LEFT_SHOULDER || index === POSE_LANDMARKS.RIGHT_SHOULDER) {
            depthEstimate = DEPTH_ESTIMATION.SHOULDER_DEPTH;
        }
        // Hips - slightly back
        else if (index === POSE_LANDMARKS.LEFT_HIP || index === POSE_LANDMARKS.RIGHT_HIP) {
            depthEstimate = DEPTH_ESTIMATION.HIP_DEPTH;
        }
        // Head/Face - forward
        else if (index <= 10) { // Face landmarks
            const noseToShoulderY = shoulderCenter.y - landmarks[POSE_LANDMARKS.NOSE].y;
            depthEstimate = noseToShoulderY * DEPTH_ESTIMATION.HEAD_DEPTH_COEF;
        }
        // Default: slight depth variation based on Y
        else {
            depthEstimate = (lm.y - COORDINATES.CENTER_OFFSET) * DEPTH_ESTIMATION.DEFAULT_Y_DEPTH;
        }
        
        return {
            x: (lm.x - COORDINATES.CENTER_OFFSET) * COORDINATES.NORMALIZE_X_SCALE, // Normalize to [-1, 1]
            y: (COORDINATES.CENTER_OFFSET - lm.y) * COORDINATES.NORMALIZE_Y_SCALE, // Flip Y and normalize
            z: depthEstimate,
            visibility: lm.visibility || 0.5
        };
    });
    
    // Apply low-pass filter to reduce jitter
    if (landmarkFilters) {
        worldLandmarks = worldLandmarks.map((wl, i) => {
            return landmarkFilters[i].filter(wl);
        });
    }
    
    return worldLandmarks;
}
