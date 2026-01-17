import { HAND_LANDMARKS, VRM_HAND_BONES } from '../constants/landmarks.js';

/**
 * Calculate finger rotations from hand landmarks using LookRotation approach
 * Similar to HolisticMotionCapture's HandRender implementation
 * 
 * @param {Array} handLandmarks - 21 hand landmarks from MediaPipe
 * @param {boolean} isLeft - True for left hand, false for right hand
 * @returns {Object} Finger rotations for VRM bones
 */
export function calculateFingerRotations(handLandmarks, isLeft = true) {
    if (!handLandmarks || handLandmarks.length < 21) {
        return null;
    }

    const fingerRotations = {};
    
    // Helper function to calculate rotation between two points
    const calculateRotation = (from, to) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        
        // Calculate angles
        // Z-axis rotation (curl/bend)
        // When finger is straight, dy should be negative (tip above base)
        // When finger is curled, dy is closer to zero or positive
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        
        // Negate the angle to fix curl direction
        // Positive rotation = finger extended (straight)
        // Negative rotation = finger curled (bent)
        const bendAngle = -(Math.atan2(-dy, horizontalDist) - Math.PI / 2);
        
        // X-axis rotation (spread)
        const spreadAngle = Math.atan2(dx, Math.abs(dz)) * (isLeft ? 1 : -1);
        
        return {
            x: spreadAngle * 0.5,
            y: 0,
            z: bendAngle
        };
    };
    
    // Special calculation for thumb (different coordinate system)
    const calculateThumbRotation = (from, to) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        
        // Thumb anatomy: extends from palm at ~90° to other fingers
        // For thumb, dx is the primary curl direction (toward/away from palm)
        // Positive dx = thumb away from palm (extended)
        // Negative/small dx = thumb toward palm (closed)
        
        // Calculate distance perpendicular to thumb curl direction
        const perpDist = Math.sqrt(dy*dy + dz*dz);
        
        // Z-axis: thumb curl toward palm
        // For left hand: positive dx = extended, negative dx = closed
        // For right hand: negative dx = extended, positive dx = closed
        // We want negative Z when closed, positive Z when extended
        const bendAngle = Math.atan2(perpDist, isLeft ? dx : -dx) - Math.PI / 2;
        
        // X-axis: thumb spread (abduction/adduction)
        const spreadAngle = Math.atan2(dy, Math.abs(dz)) * (isLeft ? -1 : 1);
        
        return {
            x: spreadAngle * 0.5,
            y: 0,
            z: bendAngle
        };
    };
    
    // Get wrist position for reference
    const wrist = handLandmarks[HAND_LANDMARKS.WRIST];
    
    // Calculate hand orientation vectors (optional - for future hand rotation calculation)
    const middleMcp = handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP];
    
    // ===== THUMB =====
    // Thumb has special orientation (perpendicular to other fingers)
    const thumbCmc = handLandmarks[HAND_LANDMARKS.THUMB_CMC];
    const thumbMcp = handLandmarks[HAND_LANDMARKS.THUMB_MCP];
    const thumbIp = handLandmarks[HAND_LANDMARKS.THUMB_IP];
    const thumbTip = handLandmarks[HAND_LANDMARKS.THUMB_TIP];
    
    if (isLeft) {
        fingerRotations[VRM_HAND_BONES.LEFT_THUMB_PROXIMAL] = calculateThumbRotation(thumbCmc, thumbMcp);
        fingerRotations[VRM_HAND_BONES.LEFT_THUMB_INTERMEDIATE] = calculateThumbRotation(thumbMcp, thumbIp);
        fingerRotations[VRM_HAND_BONES.LEFT_THUMB_DISTAL] = calculateThumbRotation(thumbIp, thumbTip);
    } else {
        fingerRotations[VRM_HAND_BONES.RIGHT_THUMB_PROXIMAL] = calculateThumbRotation(thumbCmc, thumbMcp);
        fingerRotations[VRM_HAND_BONES.RIGHT_THUMB_INTERMEDIATE] = calculateThumbRotation(thumbMcp, thumbIp);
        fingerRotations[VRM_HAND_BONES.RIGHT_THUMB_DISTAL] = calculateThumbRotation(thumbIp, thumbTip);
    }
    
    // ===== INDEX FINGER =====
    const indexMcp = handLandmarks[HAND_LANDMARKS.INDEX_FINGER_MCP];
    const indexPip = handLandmarks[HAND_LANDMARKS.INDEX_FINGER_PIP];
    const indexDip = handLandmarks[HAND_LANDMARKS.INDEX_FINGER_DIP];
    const indexTip = handLandmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
    
    if (isLeft) {
        fingerRotations[VRM_HAND_BONES.LEFT_INDEX_PROXIMAL] = calculateRotation(indexMcp, indexPip);
        fingerRotations[VRM_HAND_BONES.LEFT_INDEX_INTERMEDIATE] = calculateRotation(indexPip, indexDip);
        fingerRotations[VRM_HAND_BONES.LEFT_INDEX_DISTAL] = calculateRotation(indexDip, indexTip);
    } else {
        fingerRotations[VRM_HAND_BONES.RIGHT_INDEX_PROXIMAL] = calculateRotation(indexMcp, indexPip);
        fingerRotations[VRM_HAND_BONES.RIGHT_INDEX_INTERMEDIATE] = calculateRotation(indexPip, indexDip);
        fingerRotations[VRM_HAND_BONES.RIGHT_INDEX_DISTAL] = calculateRotation(indexDip, indexTip);
    }
    
    // ===== MIDDLE FINGER =====
    const middlePip = handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_PIP];
    const middleDip = handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_DIP];
    const middleTip = handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP];
    
    if (isLeft) {
        fingerRotations[VRM_HAND_BONES.LEFT_MIDDLE_PROXIMAL] = calculateRotation(middleMcp, middlePip);
        fingerRotations[VRM_HAND_BONES.LEFT_MIDDLE_INTERMEDIATE] = calculateRotation(middlePip, middleDip);
        fingerRotations[VRM_HAND_BONES.LEFT_MIDDLE_DISTAL] = calculateRotation(middleDip, middleTip);
    } else {
        fingerRotations[VRM_HAND_BONES.RIGHT_MIDDLE_PROXIMAL] = calculateRotation(middleMcp, middlePip);
        fingerRotations[VRM_HAND_BONES.RIGHT_MIDDLE_INTERMEDIATE] = calculateRotation(middlePip, middleDip);
        fingerRotations[VRM_HAND_BONES.RIGHT_MIDDLE_DISTAL] = calculateRotation(middleDip, middleTip);
    }
    
    // ===== RING FINGER =====
    const ringMcp = handLandmarks[HAND_LANDMARKS.RING_FINGER_MCP];
    const ringPip = handLandmarks[HAND_LANDMARKS.RING_FINGER_PIP];
    const ringDip = handLandmarks[HAND_LANDMARKS.RING_FINGER_DIP];
    const ringTip = handLandmarks[HAND_LANDMARKS.RING_FINGER_TIP];
    
    if (isLeft) {
        fingerRotations[VRM_HAND_BONES.LEFT_RING_PROXIMAL] = calculateRotation(ringMcp, ringPip);
        fingerRotations[VRM_HAND_BONES.LEFT_RING_INTERMEDIATE] = calculateRotation(ringPip, ringDip);
        fingerRotations[VRM_HAND_BONES.LEFT_RING_DISTAL] = calculateRotation(ringDip, ringTip);
    } else {
        fingerRotations[VRM_HAND_BONES.RIGHT_RING_PROXIMAL] = calculateRotation(ringMcp, ringPip);
        fingerRotations[VRM_HAND_BONES.RIGHT_RING_INTERMEDIATE] = calculateRotation(ringPip, ringDip);
        fingerRotations[VRM_HAND_BONES.RIGHT_RING_DISTAL] = calculateRotation(ringDip, ringTip);
    }
    
    // ===== PINKY FINGER =====
    const pinkyMcp = handLandmarks[HAND_LANDMARKS.PINKY_MCP];
    const pinkyPip = handLandmarks[HAND_LANDMARKS.PINKY_PIP];
    const pinkyDip = handLandmarks[HAND_LANDMARKS.PINKY_DIP];
    const pinkyTip = handLandmarks[HAND_LANDMARKS.PINKY_TIP];
    
    if (isLeft) {
        fingerRotations[VRM_HAND_BONES.LEFT_LITTLE_PROXIMAL] = calculateRotation(pinkyMcp, pinkyPip);
        fingerRotations[VRM_HAND_BONES.LEFT_LITTLE_INTERMEDIATE] = calculateRotation(pinkyPip, pinkyDip);
        fingerRotations[VRM_HAND_BONES.LEFT_LITTLE_DISTAL] = calculateRotation(pinkyDip, pinkyTip);
    } else {
        fingerRotations[VRM_HAND_BONES.RIGHT_LITTLE_PROXIMAL] = calculateRotation(pinkyMcp, pinkyPip);
        fingerRotations[VRM_HAND_BONES.RIGHT_LITTLE_INTERMEDIATE] = calculateRotation(pinkyPip, pinkyDip);
        fingerRotations[VRM_HAND_BONES.RIGHT_LITTLE_DISTAL] = calculateRotation(pinkyDip, pinkyTip);
    }
    
    return fingerRotations;
}

/**
 * Calculate both hands' rotations from MediaPipe results
 * @param {Object} results - MediaPipe Holistic results
 * @returns {Object} Combined hand rotations for both hands
 */
export function calculateHandRotations(results) {
    const handRotations = {};
    
    // Left hand
    if (results.leftHandLandmarks) {
        const leftFingers = calculateFingerRotations(results.leftHandLandmarks, true);
        if (leftFingers) {
            Object.assign(handRotations, leftFingers);
        }
    }
    
    // Right hand
    if (results.rightHandLandmarks) {
        const rightFingers = calculateFingerRotations(results.rightHandLandmarks, false);
        if (rightFingers) {
            Object.assign(handRotations, rightFingers);
        }
    }
    
    return handRotations;
}

/**
 * Calculate simplified hand pose with curl values (0-1)
 * Useful for simple hand gestures without full finger tracking
 * @param {Array} handLandmarks - 21 hand landmarks
 * @returns {Object} Curl values for each finger
 */
export function calculateHandCurl(handLandmarks) {
    if (!handLandmarks || handLandmarks.length < 21) {
        return null;
    }
    
    const wrist = handLandmarks[HAND_LANDMARKS.WRIST];
    
    // Calculate curl for each finger (0 = straight, 1 = fully curled)
    const calculateFingerCurl = (mcp, tip) => {
        const mcpDist = Math.sqrt(
            Math.pow(mcp.x - wrist.x, 2) +
            Math.pow(mcp.y - wrist.y, 2) +
            Math.pow(mcp.z - wrist.z, 2)
        );
        const tipDist = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2) +
            Math.pow(tip.z - wrist.z, 2)
        );
        
        // Normalized curl: closer tip = more curl
        return Math.max(0, Math.min(1, 1 - (tipDist / mcpDist)));
    };
    
    return {
        thumb: calculateFingerCurl(
            handLandmarks[HAND_LANDMARKS.THUMB_CMC],
            handLandmarks[HAND_LANDMARKS.THUMB_TIP]
        ),
        index: calculateFingerCurl(
            handLandmarks[HAND_LANDMARKS.INDEX_FINGER_MCP],
            handLandmarks[HAND_LANDMARKS.INDEX_FINGER_TIP]
        ),
        middle: calculateFingerCurl(
            handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP],
            handLandmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP]
        ),
        ring: calculateFingerCurl(
            handLandmarks[HAND_LANDMARKS.RING_FINGER_MCP],
            handLandmarks[HAND_LANDMARKS.RING_FINGER_TIP]
        ),
        pinky: calculateFingerCurl(
            handLandmarks[HAND_LANDMARKS.PINKY_MCP],
            handLandmarks[HAND_LANDMARKS.PINKY_TIP]
        )
    };
}
