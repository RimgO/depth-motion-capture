import { POSE_LANDMARKS, ANGLES, COORDINATES, SMOOTHING, TIMING } from '../constants/landmarks.js';

/**
 * Calculate arm rotations from 3D world landmarks
 * @param {Array} worldLandmarks - 3D world landmarks with x, y, z coordinates
 * @returns {Object} Rigged pose with arm rotations
 */
export function calculateArmRotations(worldLandmarks) {
    const lm = worldLandmarks;
    
    // Define landmarks
    const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const rElbow = lm[POSE_LANDMARKS.RIGHT_ELBOW];
    const rWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];
    const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const lElbow = lm[POSE_LANDMARKS.LEFT_ELBOW];
    const lWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
    
    const riggedPose = {
        RightUpperArm: { x: 0, y: 0, z: 0 },
        LeftUpperArm: { x: 0, y: 0, z: 0 },
        RightLowerArm: { x: 0, y: 0, z: 0 },
        LeftLowerArm: { x: 0, y: 0, z: 0 }
    };
    
    // === RIGHT ARM ===
    if (rShoulder && rElbow && rWrist) {
        // Vector from shoulder to elbow
        const dx = rElbow.x - rShoulder.x;
        const dy = rElbow.y - rShoulder.y;
        const dz = rElbow.z - rShoulder.z;
        
        // Z-axis rotation: Arm raise/lower
        // Calculate angle from vertical axis (gravity direction)
        // MediaPipe: Y increases downward, so -dy for upward direction
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        const angleZ = Math.atan2(horizontalDist, -dy);
        // Map to VRM range: negate for correct up/down direction
        riggedPose.RightUpperArm.z = -(angleZ - ANGLES.ARM_Z_OFFSET);
        
        // Debug: Log angles occasionally
        if (Math.random() < TIMING.DEBUG_LOG_SAMPLE_RATE) {
            console.log(`[Right Arm] angleZ: ${(angleZ * ANGLES.RAD_TO_DEG).toFixed(1)}°, VRM.z: ${(riggedPose.RightUpperArm.z * ANGLES.RAD_TO_DEG).toFixed(1)}°, dy: ${dy.toFixed(3)}, horizontalDist: ${horizontalDist.toFixed(3)}`);
        }
        
        // X-axis rotation: Forward/backward tilt
        if (horizontalDist > 0) {
            const angleX = Math.atan2(dz, Math.abs(dx)) * ANGLES.ARM_X_SCALE;
            riggedPose.RightUpperArm.x = angleX;
        } else {
            riggedPose.RightUpperArm.x = 0;
        }
        
        // Y-axis rotation: Internal/external rotation (arm twist)
        riggedPose.RightUpperArm.y = 0;
        
        // Elbow bend
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const lowerDx = rWrist.x - rElbow.x;
        const lowerDy = rWrist.y - rElbow.y;
        const lowerDz = rWrist.z - rElbow.z;
        const lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
        if (upperLen > 0 && lowerLen > 0) {
            const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot / (upperLen * lowerLen))));
            // elbowAngle: 0=straight (vectors aligned), π=fully bent (vectors opposite)
            // VRM: 0=straight, positive=bent (inverted for right arm)
            riggedPose.RightLowerArm.z = elbowAngle;
        }
    }
    
    // === LEFT ARM ===
    if (lShoulder && lElbow && lWrist) {
        const dx = lElbow.x - lShoulder.x;
        const dy = lElbow.y - lShoulder.y;
        const dz = lElbow.z - lShoulder.z;
        
        // Z-axis rotation: Arm raise/lower
        // Same calculation as right arm
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        const angleZ = Math.atan2(horizontalDist, -dy);
        riggedPose.LeftUpperArm.z = angleZ - ANGLES.ARM_Z_OFFSET;
        
        // Debug: Log angles occasionally
        if (Math.random() < TIMING.DEBUG_LOG_SAMPLE_RATE) {
            console.log(`[Left Arm] angleZ: ${(angleZ * ANGLES.RAD_TO_DEG).toFixed(1)}°, VRM.z: ${(riggedPose.LeftUpperArm.z * ANGLES.RAD_TO_DEG).toFixed(1)}°, dy: ${dy.toFixed(3)}, horizontalDist: ${horizontalDist.toFixed(3)}`);
        }
        
        // X-axis rotation: Forward/backward tilt  
        if (horizontalDist > 0) {
            const angleX = Math.atan2(dz, Math.abs(dx)) * ANGLES.ARM_X_SCALE;
            riggedPose.LeftUpperArm.x = angleX;
        } else {
            riggedPose.LeftUpperArm.x = 0;
        }
        
        // Y-axis rotation: Internal/external rotation
        riggedPose.LeftUpperArm.y = 0;
        
        // Elbow bend
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const lowerDx = lWrist.x - lElbow.x;
        const lowerDy = lWrist.y - lElbow.y;
        const lowerDz = lWrist.z - lElbow.z;
        const lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
        if (upperLen > 0 && lowerLen > 0) {
            const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot / (upperLen * lowerLen))));
            // Same calculation as right arm
            riggedPose.LeftLowerArm.z = -elbowAngle;
        }
    }
    
    return riggedPose;
}

/**
 * Calculate body (torso, hips, spine) rotations
 * @param {Array} worldLandmarks - 3D world landmarks
 * @returns {Object} Body pose rotations
 */
export function calculateBodyRotations(worldLandmarks) {
    const lm = worldLandmarks;
    
    const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
    const rHip = lm[POSE_LANDMARKS.RIGHT_HIP];
    const lHip = lm[POSE_LANDMARKS.LEFT_HIP];
    
    // Calculate torso center for reference
    const torsoCenter = {
        x: (rShoulder.x + lShoulder.x) / 2,
        y: (rShoulder.y + lShoulder.y) / 2,
        z: (rShoulder.z + lShoulder.z) / 2
    };
    
    const hipCenter = {
        x: (rHip.x + lHip.x) / 2,
        y: (rHip.y + lHip.y) / 2,
        z: (rHip.z + lHip.z) / 2
    };
    
    return {
        Hips: { 
            x: 0, 
            y: 0, 
            z: (hipCenter.z - torsoCenter.z) * COORDINATES.HIP_ROTATION_Z_SCALE,
            rotation: { x: 0, y: 0, z: 0 },
            worldPosition: { 
                x: hipCenter.x, 
                y: hipCenter.y, 
                z: hipCenter.z 
            }
        },
        Spine: { 
            x: 0, 
            y: 0, 
            z: (torsoCenter.z - hipCenter.z) * COORDINATES.SPINE_ROTATION_Z_SCALE 
        },
        Chest: null,
        UpperChest: null,
        Neck: null,
        Head: null,
        RightShoulder: { x: 0, y: 0, z: 0 },
        LeftShoulder: { x: 0, y: 0, z: 0 },
        RightHand: { x: 0, y: 0, z: 0 },
        LeftHand: { x: 0, y: 0, z: 0 }
    };
}

/**
 * Apply temporal smoothing to rigged pose to reduce jitter
 * @param {Object} currentPose - Current frame's rigged pose
 * @param {Object} previousPose - Previous frame's rigged pose
 * @returns {Object} Smoothed pose
 */
export function applyTemporalSmoothing(currentPose, previousPose) {
    if (!previousPose) return currentPose;
    
    const smoothingFactor = SMOOTHING.POSE_TEMPORAL;
    const smoothedPose = JSON.parse(JSON.stringify(currentPose)); // Deep copy
    
    const smoothRotation = (current, previous, key) => {
        if (!current || !previous || !current[key] || !previous[key]) return;
        
        const parts = ['x', 'y', 'z'];
        parts.forEach(axis => {
            if (typeof current[key][axis] === 'number' && typeof previous[key][axis] === 'number') {
                smoothedPose[key][axis] = previous[key][axis] + 
                    (current[key][axis] - previous[key][axis]) * (1 - smoothingFactor);
            }
        });
    };

    // Smooth all body parts
    const bodyParts = [
        'RightUpperArm', 'RightLowerArm', 'LeftUpperArm', 'LeftLowerArm',
        'RightUpperLeg', 'RightLowerLeg', 'LeftUpperLeg', 'LeftLowerLeg',
        'Hips', 'Spine', 'RightShoulder', 'LeftShoulder'
    ];
    
    bodyParts.forEach(part => {
        smoothRotation(currentPose, previousPose, part);
    });
    
    return smoothedPose;
}

/**
 * Merge arm rotations with body rotations
 * @param {Object} armPose - Arm rotations from calculateArmRotations
 * @param {Object} bodyPose - Body rotations from calculateBodyRotations
 * @returns {Object} Complete rigged pose
 */
export function mergeRiggedPose(armPose, bodyPose) {
    return {
        ...bodyPose,
        ...armPose
    };
}
