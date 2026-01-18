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
        
        // Normalize the vector for consistent calculations
        const upperArmLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (upperArmLen > 0.01) {  // Avoid division by zero
            // Normalize the vector
            const nx = dx / upperArmLen;
            const ny = dy / upperArmLen;
            const nz = dz / upperArmLen;

            
            // Z-axis rotation: Arm raise/lower
            // Calculate angle from vertical axis (gravity direction)
            // MediaPipe: Y increases downward, so -ny for upward direction
            const horizontalDist = Math.sqrt(nx*nx + nz*nz);
            const angleZ = Math.atan2(horizontalDist, -ny);
            
            // VRM version-dependent rotation
            const versionStr = String(vrmVersion);
            const isVrm0 = versionStr.startsWith('0');
            
            // Invert so positive rotation raises the arm
            // π/2 - angleZ makes horizontal position = 0, raised arm = positive
            const armRotation = Math.PI/2 - angleZ;
            // VRM 1.0: Use negative sign (opposite of left arm)
            riggedPose.RightUpperArm.z = isVrm0 ? armRotation : -armRotation;
            
            // X-axis rotation: Forward/backward tilt
            // Use asin for more accurate forward/backward detection
            // nz: positive = forward, negative = backward
            const angleX = Math.asin(Math.max(-1, Math.min(1, nz))) * ANGLES.ARM_X_SCALE;
            // VRM 1.0: Use opposite sign from left arm for symmetrical movement
            riggedPose.RightUpperArm.x = isVrm0 ? angleX : -angleX;
        }
        
        // Elbow bend and arm twist calculations
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        let lowerDx = rWrist.x - rElbow.x;
        let lowerDy = rWrist.y - rElbow.y;
        let lowerDz = rWrist.z - rElbow.z;
        let lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
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
        
        // Elbow bend calculation - use normalized vectors
        if (upperArmLen > 0.01 && lowerLen > 0.01) {
            // Normalize both vectors
            const ux = dx / upperArmLen;
            const uy = dy / upperArmLen;
            const uz = dz / upperArmLen;
            const lx = lowerDx / lowerLen;
            const ly = lowerDy / lowerLen;
            const lz = lowerDz / lowerLen;
            
            // Calculate angle between normalized vectors
            const dot = ux*lx + uy*ly + uz*lz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
            // elbowAngle: 0=straight (vectors aligned), π=fully bent (vectors opposite)
            // VRM: 0=straight, negative=bent for right arm
            riggedPose.RightLowerArm.z = -elbowAngle;
        }
    }
    
    // === LEFT ARM ===
    if (lShoulder && lElbow && lWrist) {
        const dx = lElbow.x - lShoulder.x;
        const dy = lElbow.y - lShoulder.y;
        const dz = lElbow.z - lShoulder.z;
        
        // Normalize the vector for consistent calculations
        const upperArmLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (upperArmLen > 0.01) {  // Avoid division by zero
            const nx = dx / upperArmLen;
            const ny = dy / upperArmLen;
            const nz = dz / upperArmLen;
            
            // Z-axis rotation: Arm raise/lower
            // Same calculation as right arm
            const horizontalDist = Math.sqrt(nx*nx + nz*nz);
            const angleZ = Math.atan2(horizontalDist, -ny);
            
            // VRM version-dependent rotation (mirrored from right arm)
            const versionStr = String(vrmVersion);
            const isVrm0 = versionStr.startsWith('0');
            const armRotation = Math.PI/2 - angleZ;
            riggedPose.LeftUpperArm.z = isVrm0 ? -armRotation : armRotation;
            
            // X-axis rotation: Forward/backward tilt
            // Same calculation as right arm (mirrored sign for VRM version)
            const angleX = Math.asin(Math.max(-1, Math.min(1, nz))) * ANGLES.ARM_X_SCALE;
            riggedPose.LeftUpperArm.x = isVrm0 ? -angleX : angleX;
        }
        
        // Elbow bend and arm twist calculations
        const upperLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
        let lowerDx = lWrist.x - lElbow.x;
        let lowerDy = lWrist.y - lElbow.y;
        let lowerDz = lWrist.z - lElbow.z;
        let lowerLen = Math.sqrt(lowerDx*lowerDx + lowerDy*lowerDy + lowerDz*lowerDz);
        
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
        
        // Elbow bend calculation - use normalized vectors
        if (upperArmLen > 0.01 && lowerLen > 0.01) {
            // Normalize both vectors
            const ux = dx / upperArmLen;
            const uy = dy / upperArmLen;
            const uz = dz / upperArmLen;
            const lx = lowerDx / lowerLen;
            const ly = lowerDy / lowerLen;
            const lz = lowerDz / lowerLen;
            
            // Calculate angle between normalized vectors
            const dot = ux*lx + uy*ly + uz*lz;
            const elbowAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
            // elbowAngle: 0=straight (vectors aligned), π=fully bent (vectors opposite)
            // VRM: 0=straight, positive=bent for left arm
            riggedPose.LeftLowerArm.z = elbowAngle;
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
    
    // === SPINE/TORSO ROTATION ===
    // Calculate spine vector from hips to shoulders
    const spineVec = {
        x: torsoCenter.x - hipCenter.x,
        y: torsoCenter.y - hipCenter.y,
        z: torsoCenter.z - hipCenter.z
    };
    const spineLen = Math.sqrt(spineVec.x**2 + spineVec.y**2 + spineVec.z**2);
    
    let spineRotation = { x: 0, y: 0, z: 0 };
    
    if (spineLen > 0.01) {
        const nx = spineVec.x / spineLen;
        const ny = spineVec.y / spineLen;
        const nz = spineVec.z / spineLen;
        
        // Z-axis: Left/right lean (lateral flexion)
        // When leaning right, nx becomes positive (moving right)
        // This should control the roll rotation
        spineRotation.z = Math.atan2(nz, -ny);
        
        // X-axis: Forward/backward lean  
        // When leaning forward, nz becomes positive (moving away from camera)
        // This should control the pitch rotation
        spineRotation.x = Math.atan2(nx, -ny);
        
        // Y-axis: Rotation (twist) - using shoulder orientation
        const shoulderVec = {
            x: rShoulder.x - lShoulder.x,
            y: rShoulder.y - lShoulder.y,
            z: rShoulder.z - lShoulder.z
        };
        // Twist angle from shoulder line
        spineRotation.y = Math.atan2(shoulderVec.z, shoulderVec.x);
    }
    
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
            z: 0,
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
            z: 0
        },
        Chest: { 
            x: 0,
            y: 0,
            z: 0
        },
        UpperChest: { 
            x: 0,
            y: 0,
            z: 0
        },
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
