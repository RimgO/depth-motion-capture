import { POSE_LANDMARKS, ANGLES, COORDINATES, SMOOTHING, TIMING } from '../constants/landmarks.js';

/**
 * Calculate arm rotations from 3D world landmarks
 * @param {Array} worldLandmarks - 3D world landmarks with x, y, z coordinates
 * @param {Object} handLandmarks - Hand landmarks from MediaPipe (optional, for better twist detection)
 * @param {string} vrmVersion - VRM version ('0' for VRM0.x, '1' for VRM1.0)
 * @returns {Object} Rigged pose with arm rotations
 */
export function calculateArmRotations(worldLandmarks, handLandmarks = null, vrmVersion = '1') {
    const lm = worldLandmarks;
    
    // Debug: Log VRM version on first call
    if (!calculateArmRotations._versionLogged) {
        console.log(`[calculateArmRotations] VRM Version: "${vrmVersion}" (type: ${typeof vrmVersion})`);
        calculateArmRotations._versionLogged = true;
    }
    
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
        // VRM version-dependent rotation
        // Expand range: subtract offset to allow full arm raise
        const versionStr = String(vrmVersion);
        const isVrm0 = versionStr.startsWith('0');
        const armRotation = angleZ - ANGLES.ARM_Z_OFFSET;
        riggedPose.RightUpperArm.z = isVrm0 ? -armRotation : armRotation;
        
        // X-axis rotation: Forward/backward tilt
        if (horizontalDist > 0) {
            const angleX = Math.atan2(dz, Math.abs(dx)) * ANGLES.ARM_X_SCALE;
            riggedPose.RightUpperArm.x = angleX;
        } else {
            riggedPose.RightUpperArm.x = 0;
        }
        
        // Elbow bend and arm twist calculations
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const lowerDx = rWrist.x - rElbow.x;
        const lowerDy = rWrist.y - rElbow.y;
        const lowerDz = rWrist.z - rElbow.z;
        const lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
        // Y-axis rotation: Internal/external rotation (arm twist)
        // Use hand landmarks if available for more accurate twist detection
        if (handLandmarks?.rightHandLandmarks && handLandmarks.rightHandLandmarks.length > 0) {
            // Use index and pinky knuckles to determine hand orientation
            const indexKnuckle = handLandmarks.rightHandLandmarks[5]; // INDEX_FINGER_MCP
            const pinkyKnuckle = handLandmarks.rightHandLandmarks[17]; // PINKY_MCP
            
            if (indexKnuckle && pinkyKnuckle) {
                // Vector across palm (from pinky to index)
                const palmVecX = indexKnuckle.x - pinkyKnuckle.x;
                const palmVecY = indexKnuckle.y - pinkyKnuckle.y;
                const palmVecZ = indexKnuckle.z - pinkyKnuckle.z;
                
                // Normalize palm vector
                const palmLen = Math.sqrt(palmVecX*palmVecX + palmVecY*palmVecY + palmVecZ*palmVecZ);
                if (palmLen > 0.01) {
                    const px = palmVecX / palmLen;
                    const py = palmVecY / palmLen;
                    const pz = palmVecZ / palmLen;
                    
                    // Normalize forearm vector (elbow to wrist)
                    if (lowerLen > 0.01) {
                        const fx = lowerDx / lowerLen;
                        const fy = lowerDy / lowerLen;
                        const fz = lowerDz / lowerLen;
                        
                        // Project palm vector onto plane perpendicular to forearm
                        // This removes the component along the forearm axis
                        const dot = px * fx + py * fy + pz * fz;
                        const perpPalmX = px - dot * fx;
                        const perpPalmY = py - dot * fy;
                        const perpPalmZ = pz - dot * fz;
                        
                        // Renormalize projected vector
                        const perpLen = Math.sqrt(perpPalmX*perpPalmX + perpPalmY*perpPalmY + perpPalmZ*perpPalmZ);
                        if (perpLen > 0.01) {
                            // Calculate twist angle using only Y component of perpendicular palm vector
                            // This isolates the pronation/supination rotation
                            const twistAngle = Math.asin(Math.max(-1, Math.min(1, perpPalmY / perpLen)));
                            riggedPose.RightUpperArm.y = -twistAngle * 1.2; // Reduced scale for smoother motion
                        } else {
                            riggedPose.RightUpperArm.y = 0;
                        }
                    } else {
                        riggedPose.RightUpperArm.y = 0;
                    }
                } else {
                    riggedPose.RightUpperArm.y = 0;
                }
            } else {
                riggedPose.RightUpperArm.y = 0;
            }
        } else {
            // Fallback: use forearm orientation
            const forearmAngleXZ = Math.atan2(lowerDx, lowerDz);
            const upperArmAngleXZ = Math.atan2(dx, dz);
            let twistAngle = forearmAngleXZ - upperArmAngleXZ;
            if (twistAngle > Math.PI) twistAngle -= 2 * Math.PI;
            if (twistAngle < -Math.PI) twistAngle += 2 * Math.PI;
            riggedPose.RightUpperArm.y = twistAngle * 0.5;
        }
        
        if (upperLen > 0 && lowerLen > 0) {
            const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot / (upperLen * lowerLen))));
            // elbowAngle: 0=straight (vectors aligned), π=fully bent (vectors opposite)
            // VRM: 0=straight, positive=bent
            riggedPose.RightLowerArm.z = -elbowAngle; // Negative for correct bend direction
        }
    }
    
    // === LEFT ARM ===
    if (lShoulder && lElbow && lWrist) {
        const dx = lElbow.x - lShoulder.x;
        const dy = lElbow.y - lShoulder.y;
        const dz = lElbow.z - lShoulder.z;
        
        // Z-axis rotation: Arm raise/lower
        // Mirrored from right arm
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        const angleZ = Math.atan2(horizontalDist, -dy);
        // VRM version-dependent rotation (mirrored from right)
        const versionStr = String(vrmVersion);
        const isVrm0 = versionStr.startsWith('0');
        const armRotation = angleZ - ANGLES.ARM_Z_OFFSET;
        riggedPose.LeftUpperArm.z = isVrm0 ? armRotation : -armRotation;
        
        // X-axis rotation: Forward/backward tilt  
        if (horizontalDist > 0) {
            const angleX = Math.atan2(dz, Math.abs(dx)) * ANGLES.ARM_X_SCALE;
            riggedPose.LeftUpperArm.x = angleX;
        } else {
            riggedPose.LeftUpperArm.x = 0;
        }
        
        // Elbow bend and arm twist calculations
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const lowerDx = lWrist.x - lElbow.x;
        const lowerDy = lWrist.y - lElbow.y;
        const lowerDz = lWrist.z - lElbow.z;
        const lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
        // Y-axis rotation: Internal/external rotation (arm twist)
        // Use hand landmarks if available for more accurate twist detection
        if (handLandmarks?.leftHandLandmarks && handLandmarks.leftHandLandmarks.length > 0) {
            // Use index and pinky knuckles to determine hand orientation
            const indexKnuckle = handLandmarks.leftHandLandmarks[5]; // INDEX_FINGER_MCP
            const pinkyKnuckle = handLandmarks.leftHandLandmarks[17]; // PINKY_MCP
            
            if (indexKnuckle && pinkyKnuckle) {
                // Vector across palm (from pinky to index)
                const palmVecX = indexKnuckle.x - pinkyKnuckle.x;
                const palmVecY = indexKnuckle.y - pinkyKnuckle.y;
                const palmVecZ = indexKnuckle.z - pinkyKnuckle.z;
                
                // Normalize palm vector
                const palmLen = Math.sqrt(palmVecX*palmVecX + palmVecY*palmVecY + palmVecZ*palmVecZ);
                if (palmLen > 0.01) {
                    const px = palmVecX / palmLen;
                    const py = palmVecY / palmLen;
                    const pz = palmVecZ / palmLen;
                    
                    // Normalize forearm vector (elbow to wrist)
                    if (lowerLen > 0.01) {
                        const fx = lowerDx / lowerLen;
                        const fy = lowerDy / lowerLen;
                        const fz = lowerDz / lowerLen;
                        
                        // Project palm vector onto plane perpendicular to forearm
                        // This removes the component along the forearm axis
                        const dot = px * fx + py * fy + pz * fz;
                        const perpPalmX = px - dot * fx;
                        const perpPalmY = py - dot * fy;
                        const perpPalmZ = pz - dot * fz;
                        
                        // Renormalize projected vector
                        const perpLen = Math.sqrt(perpPalmX*perpPalmX + perpPalmY*perpPalmY + perpPalmZ*perpPalmZ);
                        if (perpLen > 0.01) {
                            // Calculate twist angle using only Y component of perpendicular palm vector
                            // This isolates the pronation/supination rotation
                            const twistAngle = Math.asin(Math.max(-1, Math.min(1, perpPalmY / perpLen)));
                            riggedPose.LeftUpperArm.y = twistAngle * 1.2; // Reduced scale (inverted for left arm)
                        } else {
                            riggedPose.LeftUpperArm.y = 0;
                        }
                    } else {
                        riggedPose.LeftUpperArm.y = 0;
                    }
                } else {
                    riggedPose.LeftUpperArm.y = 0;
                }
            } else {
                riggedPose.LeftUpperArm.y = 0;
            }
        } else {
            // Fallback: use forearm orientation
            const forearmAngleXZ = Math.atan2(lowerDx, lowerDz);
            const upperArmAngleXZ = Math.atan2(dx, dz);
            let twistAngle = forearmAngleXZ - upperArmAngleXZ;
            if (twistAngle > Math.PI) twistAngle -= 2 * Math.PI;
            if (twistAngle < -Math.PI) twistAngle += 2 * Math.PI;
            riggedPose.LeftUpperArm.y = -twistAngle * 0.5;
        }
        
        if (upperLen > 0 && lowerLen > 0) {
            const dot = dx*lowerDx + dy*lowerDy + dz*lowerDz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot / (upperLen * lowerLen))));
            // Same calculation as right arm
            riggedPose.LeftLowerArm.z = elbowAngle; // Positive for correct bend direction
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
    
    // Head/Neck rotation calculation - Complete: X, Y, Z axis rotations
    const nose = lm[POSE_LANDMARKS.NOSE];
    const leftEar = lm[POSE_LANDMARKS.LEFT_EAR];
    const rightEar = lm[POSE_LANDMARKS.RIGHT_EAR];
    
    let neckRotation = null;
    let headRotation = null;
    
    if (nose && leftEar && rightEar) {
        // Calculate ear center (back of head reference)
        const earCenterX = (leftEar.x + rightEar.x) / 2;
        const earCenterY = (leftEar.y + rightEar.y) / 2;
        const earCenterZ = (leftEar.z + rightEar.z) / 2;
        
        // Forward vector from ear center to nose
        const dx = nose.x - earCenterX;
        const dy = nose.y - earCenterY;
        const dz = nose.z - earCenterZ;
        
        // Y-axis rotation (yaw): left/right head turn
        // MediaPipe: X+ is right, Z- is toward camera
        // VRM scene is rotated 180°, so forward is inverted
        const headYaw = Math.atan2(dx, -dz);
        
        // X-axis rotation (pitch): up/down head tilt
        // MediaPipe: Y+ is down
        // Calculate angle from horizontal plane
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        const headPitch = Math.atan2(dy, horizontalDist);
        
        // Z-axis rotation (roll): temporarily disabled for debugging
        const headRoll = 0;
        
        // Split between neck (60%) and head (40%)
        neckRotation = {
            x: headPitch * 0.6,
            y: headYaw * 0.6,
            z: headRoll * 0.6
        };
        
        headRotation = {
            x: headPitch * 0.4,
            y: headYaw * 0.4,
            z: headRoll * 0.4
        };
    }
    
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
        Neck: neckRotation,
        Head: headRotation,
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
    const yAxisSmoothingFactor = 0.1; // Much faster response for Y-axis rotation (arm twist)
    const blinkSmoothingFactor = 0.2; // Fast response for blinks (need to be responsive)
    const mouthSmoothingFactor = 0.4; // Medium smoothing for mouth shapes
    const headSmoothingFactor = 0.6; // Heavier smoothing for head/neck stability
    const smoothedPose = JSON.parse(JSON.stringify(currentPose)); // Deep copy
    
    const smoothRotation = (current, previous, key) => {
        if (!current || !previous || !current[key] || !previous[key]) return;
        
        const parts = ['x', 'y', 'z'];
        parts.forEach(axis => {
            if (typeof current[key][axis] === 'number' && typeof previous[key][axis] === 'number') {
                // Use different smoothing factors for different body parts
                let factor = smoothingFactor;
                
                // Faster response for arm twist (Y-axis rotation)
                if (axis === 'y' && (key === 'RightUpperArm' || key === 'LeftUpperArm')) {
                    factor = yAxisSmoothingFactor;
                }
                // Heavier smoothing for head/neck for stability
                else if (key === 'Neck' || key === 'Head') {
                    factor = headSmoothingFactor;
                }
                
                smoothedPose[key][axis] = previous[key][axis] + 
                    (current[key][axis] - previous[key][axis]) * (1 - factor);
            }
        });
    };

    // Smooth face expressions (BlendShape values 0-1)
    if (currentPose.Face && previousPose.Face) {
        smoothedPose.Face = {};
        
        // Blink values - use fast smoothing for responsive blinks
        ['blinkLeft', 'blinkRight'].forEach(key => {
            if (typeof currentPose.Face[key] === 'number' && typeof previousPose.Face[key] === 'number') {
                smoothedPose.Face[key] = previousPose.Face[key] + 
                    (currentPose.Face[key] - previousPose.Face[key]) * (1 - blinkSmoothingFactor);
            }
        });
        
        // Mouth shapes - use medium smoothing for balance
        ['mouthA', 'mouthI', 'mouthU', 'mouthE', 'mouthO'].forEach(key => {
            if (typeof currentPose.Face[key] === 'number' && typeof previousPose.Face[key] === 'number') {
                smoothedPose.Face[key] = previousPose.Face[key] + 
                    (currentPose.Face[key] - previousPose.Face[key]) * (1 - mouthSmoothingFactor);
            }
        });
    }

    // Smooth all body parts
    const bodyParts = [
        'RightUpperArm', 'RightLowerArm', 'LeftUpperArm', 'LeftLowerArm',
        'RightUpperLeg', 'RightLowerLeg', 'LeftUpperLeg', 'LeftLowerLeg',
        'Hips', 'Spine', 'RightShoulder', 'LeftShoulder',
        'Neck', 'Head'  // Add head/neck smoothing
    ];
    
    bodyParts.forEach(part => {
        smoothRotation(currentPose, previousPose, part);
    });
    
    return smoothedPose;
}

/**
 * Merge arm rotations with body rotations and hand rotations
 * @param {Object} armPose - Arm rotations from calculateArmRotations
 * @param {Object} bodyPose - Body rotations from calculateBodyRotations
 * @param {Object} handPose - Hand rotations from calculateHandRotations (optional)
 * @returns {Object} Complete rigged pose
 */
export function mergeRiggedPose(armPose, bodyPose, handPose = {}) {
    return {
        ...bodyPose,
        ...armPose,
        ...handPose
    };
}
