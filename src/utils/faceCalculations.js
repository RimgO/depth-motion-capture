/**
 * Face Expression Calculations
 * 
 * Calculates facial expressions from MediaPipe Face Mesh landmarks (468 points)
 * and maps them to VRM BlendShape values for both VRM 0.x and VRM 1.0
 * 
 * Reference: HolisticMotionCapture BlinkRender, MouthRender, PupilRender methods
 */

import { FACE_LANDMARKS } from '../constants/landmarks.js';

/**
 * Calculate Euclidean distance between two 2D/3D points
 */
function distance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate blink values for left and right eyes
 * Uses Eye Aspect Ratio (EAR) method
 * 
 * @param {Array} faceLandmarks - 468 face landmarks from MediaPipe
 * @returns {Object} { leftBlink: 0-1, rightBlink: 0-1 }
 */
export function calculateBlink(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 478) {
        return { leftBlink: 0, rightBlink: 0 };
    }

    // Left eye aspect ratio
    const leftEyeUpper = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_UPPER];
    const leftEyeLower = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_LOWER];
    const leftEyeInner = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_INNER];
    const leftEyeOuter = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];

    // Calculate vertical and horizontal distances
    const leftVertical = distance(leftEyeUpper, leftEyeLower);
    const leftHorizontal = distance(leftEyeInner, leftEyeOuter);
    
    // Eye Aspect Ratio (EAR) - lower value = more closed
    const leftEAR = leftVertical / (leftHorizontal + 0.001); // avoid division by zero

    // Right eye aspect ratio
    const rightEyeUpper = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_UPPER];
    const rightEyeLower = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_LOWER];
    const rightEyeInner = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_INNER];
    const rightEyeOuter = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];

    const rightVertical = distance(rightEyeUpper, rightEyeLower);
    const rightHorizontal = distance(rightEyeInner, rightEyeOuter);
    const rightEAR = rightVertical / (rightHorizontal + 0.001);

    // Convert EAR to blink value (0 = open, 1 = closed)
    // Typical EAR range: 0.15-0.25 (open), <0.1 (closed)
    // Normalize and invert: higher EAR = less blink
    const leftBlinkRaw = 1.0 - Math.min(1.0, Math.max(0.0, (leftEAR - 0.05) / 0.15));
    const rightBlinkRaw = 1.0 - Math.min(1.0, Math.max(0.0, (rightEAR - 0.05) / 0.15));

    // Apply threshold for full blink (from HolisticMotionCapture)
    const leftBlink = leftBlinkRaw > 0.65 ? 1.0 : leftBlinkRaw;
    const rightBlink = rightBlinkRaw > 0.65 ? 1.0 : rightBlinkRaw;

    return {
        leftBlink: Math.min(1.0, Math.max(0.0, leftBlink)),
        rightBlink: Math.min(1.0, Math.max(0.0, rightBlink))
    };
}

/**
 * Calculate mouth shape values for AIUEO vowels
 * 
 * @param {Array} faceLandmarks - 468 face landmarks from MediaPipe
 * @returns {Object} { a: 0-1, i: 0-1, u: 0-1, e: 0-1, o: 0-1 }
 */
export function calculateMouthShape(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 478) {
        return { a: 0, i: 0, u: 0, e: 0, o: 0 };
    }

    const mouthTop = faceLandmarks[FACE_LANDMARKS.MOUTH_TOP];
    const mouthBottom = faceLandmarks[FACE_LANDMARKS.MOUTH_BOTTOM];
    const mouthLeft = faceLandmarks[FACE_LANDMARKS.MOUTH_LEFT];
    const mouthRight = faceLandmarks[FACE_LANDMARKS.MOUTH_RIGHT];

    // Calculate mouth dimensions
    const mouthHeight = distance(mouthTop, mouthBottom);
    const mouthWidth = distance(mouthLeft, mouthRight);
    
    // Mouth aspect ratio
    const aspectRatio = mouthWidth / (mouthHeight + 0.001);
    
    // Normalize based on typical ranges
    const openness = Math.min(1.0, Math.max(0.0, mouthHeight / 0.1)); // 0.1 is max expected
    const wideness = Math.min(1.0, Math.max(0.0, (mouthWidth - 0.05) / 0.05)); // normalize width

    // Vowel shape detection heuristics
    // A (あ): Large vertical opening, moderate width
    const a = openness > 0.3 && aspectRatio < 3.0 ? openness * 0.8 : 0;
    
    // I (い): Wide mouth, minimal opening (smile)
    const i = wideness > 0.4 && openness < 0.3 ? wideness * 0.7 : 0;
    
    // U (う): Narrow mouth, lips forward (low width, moderate open)
    const u = aspectRatio < 1.5 && openness > 0.15 && openness < 0.4 ? 0.6 : 0;
    
    // E (え): Moderate width and opening
    const e = wideness > 0.3 && openness > 0.15 && openness < 0.5 && aspectRatio > 2.0 ? 0.5 : 0;
    
    // O (お): Circular opening (balanced height and width)
    const o = openness > 0.3 && aspectRatio > 1.5 && aspectRatio < 2.5 ? openness * 0.7 : 0;

    // Normalize so total doesn't exceed 1.0 (mutual exclusivity)
    const total = a + i + u + e + o;
    const scale = total > 1.0 ? 1.0 / total : 1.0;

    return {
        a: a * scale,
        i: i * scale,
        u: u * scale,
        e: e * scale,
        o: o * scale
    };
}

/**
 * Calculate eye gaze direction (optional - for advanced implementation)
 * 
 * @param {Array} faceLandmarks - 468 face landmarks from MediaPipe
 * @returns {Object} { horizontal: -1 to 1, vertical: -1 to 1 }
 */
export function calculateEyeGaze(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 478) {
        return { horizontal: 0, vertical: 0 };
    }

    // Iris center points (MediaPipe provides these at indices 468-478)
    const leftIris = faceLandmarks[FACE_LANDMARKS.LEFT_IRIS_CENTER];
    const rightIris = faceLandmarks[FACE_LANDMARKS.RIGHT_IRIS_CENTER];

    // Eye boundaries
    const leftEyeInner = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_INNER];
    const leftEyeOuter = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];
    const rightEyeInner = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_INNER];
    const rightEyeOuter = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];

    // Calculate iris position relative to eye center
    const leftEyeCenterX = (leftEyeInner.x + leftEyeOuter.x) / 2;
    const rightEyeCenterX = (rightEyeInner.x + rightEyeOuter.x) / 2;
    
    const leftEyeWidth = distance(leftEyeInner, leftEyeOuter);
    const rightEyeWidth = distance(rightEyeInner, rightEyeOuter);

    // Horizontal gaze (-1 = left, 1 = right)
    const leftHorizontal = (leftIris.x - leftEyeCenterX) / (leftEyeWidth * 0.5);
    const rightHorizontal = (rightIris.x - rightEyeCenterX) / (rightEyeWidth * 0.5);
    const horizontal = (leftHorizontal + rightHorizontal) / 2;

    // Vertical gaze calculation (simplified)
    const leftEyeTop = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_TOP];
    const leftEyeBottom = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_BOTTOM];
    const leftEyeCenterY = (leftEyeTop.y + leftEyeBottom.y) / 2;
    const leftEyeHeight = distance(leftEyeTop, leftEyeBottom);
    const vertical = (leftIris.y - leftEyeCenterY) / (leftEyeHeight * 0.5);

    return {
        horizontal: Math.min(1.0, Math.max(-1.0, horizontal)),
        vertical: Math.min(1.0, Math.max(-1.0, vertical))
    };
}

/**
 * Main function: Calculate all face expressions
 * This is the primary export that combines all face calculations
 * 
 * @param {Array} faceLandmarks - 468 face landmarks from MediaPipe
 * @returns {Object} Face expression data for VRM BlendShapes
 */
export function calculateFaceExpressions(faceLandmarks) {
    if (!faceLandmarks) {
        return null;
    }

    const blink = calculateBlink(faceLandmarks);
    const mouth = calculateMouthShape(faceLandmarks);
    // Eye gaze is optional for now - can be enabled later
    // const gaze = calculateEyeGaze(faceLandmarks);

    return {
        // Blink values
        blinkLeft: blink.leftBlink,
        blinkRight: blink.rightBlink,
        
        // Mouth shapes (AIUEO)
        mouthA: mouth.a,
        mouthI: mouth.i,
        mouthU: mouth.u,
        mouthE: mouth.e,
        mouthO: mouth.o
        
        // Eye gaze (optional - commented out for now)
        // eyeGazeX: gaze.horizontal,
        // eyeGazeY: gaze.vertical
    };
}
