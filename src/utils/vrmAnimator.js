
import * as THREE from 'three';
import { SMOOTHING, COORDINATES } from '../constants/landmarks.js';

export const animateVRM = (vrm, riggedPose, captureSettings) => {
    const appliedPose = {};

    const setRotation = (name, rotation, lerpAmount = SMOOTHING.VRM_BONE_SLERP) => {
        if (!vrm || !vrm.humanoid) {
            console.warn('[animateVRM] VRM or Humanoid missing');
            return;
        }
        const bone = vrm.humanoid.getNormalizedBoneNode(name);
        if (!bone) {
            // Throttle this log - maybe suppress entirely in valid cases
            // if (Math.random() < 0.001) console.warn(`[animateVRM] Bone not found: ${name}`);
            return;
        }
        if (rotation) {
            const targetQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
            );
            bone.quaternion.slerp(targetQuat, lerpAmount);
            appliedPose[name] = rotation;

            // Debug log for RightUpperArm to verify movement
            if (name === 'rightUpperArm' && Math.random() < 0.001) {
                // console.log(`[animateVRM] Rotating ${name}:`, { rotation, euler: bone.rotation, quat: bone.quaternion });
            }
        }
    };

    // Core Body - Hips
    if (captureSettings.trackHips && riggedPose.Hips) {
        const hips = vrm.humanoid.getNormalizedBoneNode('hips');
        if (hips) {
            hips.position.set(
                -riggedPose.Hips.worldPosition.x,
                riggedPose.Hips.worldPosition.y + COORDINATES.VRM_HIP_Y_OFFSET,
                -riggedPose.Hips.worldPosition.z
            );
            if (riggedPose.Hips.rotation) {
                setRotation('hips', riggedPose.Hips.rotation);
            }
        }
    }

    // Spine / Core (Spine, Chest, Neck, Head)
    if (captureSettings.trackSpine) {
        if (riggedPose.Spine) setRotation('spine', riggedPose.Spine);
        if (riggedPose.Chest) setRotation('chest', riggedPose.Chest);
        if (riggedPose.UpperChest) setRotation('upperChest', riggedPose.UpperChest);
        if (riggedPose.Neck) setRotation('neck', riggedPose.Neck);
        if (riggedPose.Head) setRotation('head', riggedPose.Head);

        // Shoulders (Grouped with Spine/Torso for now)
        if (riggedPose.RightShoulder) {
            const rot = { ...riggedPose.RightShoulder };
            rot.z *= SMOOTHING.SHOULDER_Z_DAMPEN;
            setRotation('rightShoulder', rot);
        }
        if (riggedPose.LeftShoulder) {
            const rot = { ...riggedPose.LeftShoulder };
            rot.z *= SMOOTHING.SHOULDER_Z_DAMPEN;
            setRotation('leftShoulder', rot);
        }
    }

    // Upper Arms
    if (captureSettings.trackUpperArm) {
        if (riggedPose.RightUpperArm) {
            const rot = { ...riggedPose.RightUpperArm };
            if (rot.y !== undefined) {
                const bone = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
                if (bone) {
                    const yQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot.y, 0, 'XYZ'));
                    bone.quaternion.slerp(yQuat, 0.95);
                    const xzQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x || 0, 0, rot.z || 0, 'XYZ'));
                    bone.quaternion.multiply(xzQuat);
                    appliedPose.rightUpperArm = rot;
                } else {
                    setRotation('rightUpperArm', rot);
                }
            } else {
                setRotation('rightUpperArm', rot);
            }
        }
        if (riggedPose.LeftUpperArm) {
            const rot = { ...riggedPose.LeftUpperArm };
            if (rot.y !== undefined) {
                const bone = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
                if (bone) {
                    const yQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot.y, 0, 'XYZ'));
                    bone.quaternion.slerp(yQuat, 0.95);
                    const xzQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x || 0, 0, rot.z || 0, 'XYZ'));
                    bone.quaternion.multiply(xzQuat);
                    appliedPose.leftUpperArm = rot;
                } else {
                    setRotation('leftUpperArm', rot);
                }
            } else {
                setRotation('leftUpperArm', rot);
            }
        }
    }

    // Lower Arms
    if (captureSettings.trackLowerArm) {
        if (riggedPose.RightLowerArm) setRotation('rightLowerArm', riggedPose.RightLowerArm);
        if (riggedPose.LeftLowerArm) setRotation('leftLowerArm', riggedPose.LeftLowerArm);
    }

    // Fingers (Hands)
    if (captureSettings.trackFingers) {
        if (riggedPose.RightHand) setRotation('rightHand', riggedPose.RightHand);
        if (riggedPose.LeftHand) setRotation('leftHand', riggedPose.LeftHand);

        const fingerLerp = 0.9;
        // Left Hand Fingers
        if (riggedPose.leftThumbProximal) setRotation('leftThumbProximal', riggedPose.leftThumbProximal, fingerLerp);
        if (riggedPose.leftThumbIntermediate) setRotation('leftThumbIntermediate', riggedPose.leftThumbIntermediate, fingerLerp);
        if (riggedPose.leftThumbDistal) setRotation('leftThumbDistal', riggedPose.leftThumbDistal, fingerLerp);
        if (riggedPose.leftIndexProximal) setRotation('leftIndexProximal', riggedPose.leftIndexProximal, fingerLerp);
        if (riggedPose.leftIndexIntermediate) setRotation('leftIndexIntermediate', riggedPose.leftIndexIntermediate, fingerLerp);
        if (riggedPose.leftIndexDistal) setRotation('leftIndexDistal', riggedPose.leftIndexDistal, fingerLerp);
        if (riggedPose.leftMiddleProximal) setRotation('leftMiddleProximal', riggedPose.leftMiddleProximal, fingerLerp);
        if (riggedPose.leftMiddleIntermediate) setRotation('leftMiddleIntermediate', riggedPose.leftMiddleIntermediate, fingerLerp);
        if (riggedPose.leftMiddleDistal) setRotation('leftMiddleDistal', riggedPose.leftMiddleDistal, fingerLerp);
        if (riggedPose.leftRingProximal) setRotation('leftRingProximal', riggedPose.leftRingProximal, fingerLerp);
        if (riggedPose.leftRingIntermediate) setRotation('leftRingIntermediate', riggedPose.leftRingIntermediate, fingerLerp);
        if (riggedPose.leftRingDistal) setRotation('leftRingDistal', riggedPose.leftRingDistal, fingerLerp);
        if (riggedPose.leftLittleProximal) setRotation('leftLittleProximal', riggedPose.leftLittleProximal, fingerLerp);
        if (riggedPose.leftLittleIntermediate) setRotation('leftLittleIntermediate', riggedPose.leftLittleIntermediate, fingerLerp);
        if (riggedPose.leftLittleDistal) setRotation('leftLittleDistal', riggedPose.leftLittleDistal, fingerLerp);

        // Right Hand Fingers
        if (riggedPose.rightThumbProximal) setRotation('rightThumbProximal', riggedPose.rightThumbProximal, fingerLerp);
        if (riggedPose.rightThumbIntermediate) setRotation('rightThumbIntermediate', riggedPose.rightThumbIntermediate, fingerLerp);
        if (riggedPose.rightThumbDistal) setRotation('rightThumbDistal', riggedPose.rightThumbDistal, fingerLerp);
        if (riggedPose.rightIndexProximal) setRotation('rightIndexProximal', riggedPose.rightIndexProximal, fingerLerp);
        if (riggedPose.rightIndexIntermediate) setRotation('rightIndexIntermediate', riggedPose.rightIndexIntermediate, fingerLerp);
        if (riggedPose.rightIndexDistal) setRotation('rightIndexDistal', riggedPose.rightIndexDistal, fingerLerp);
        if (riggedPose.rightMiddleProximal) setRotation('rightMiddleProximal', riggedPose.rightMiddleProximal, fingerLerp);
        if (riggedPose.rightMiddleIntermediate) setRotation('rightMiddleIntermediate', riggedPose.rightMiddleIntermediate, fingerLerp);
        if (riggedPose.rightMiddleDistal) setRotation('rightMiddleDistal', riggedPose.rightMiddleDistal, fingerLerp);
        if (riggedPose.rightRingProximal) setRotation('rightRingProximal', riggedPose.rightRingProximal, fingerLerp);
        if (riggedPose.rightRingIntermediate) setRotation('rightRingIntermediate', riggedPose.rightRingIntermediate, fingerLerp);
        if (riggedPose.rightRingDistal) setRotation('rightRingDistal', riggedPose.rightRingDistal, fingerLerp);
        if (riggedPose.rightLittleProximal) setRotation('rightLittleProximal', riggedPose.rightLittleProximal, fingerLerp);
        if (riggedPose.rightLittleIntermediate) setRotation('rightLittleIntermediate', riggedPose.rightLittleIntermediate, fingerLerp);
        if (riggedPose.rightLittleDistal) setRotation('rightLittleDistal', riggedPose.rightLittleDistal, fingerLerp);
    }

    // Legs
    if (captureSettings.captureLowerBody) {
        if (captureSettings.trackUpperLeg) {
            if (riggedPose.RightUpperLeg) setRotation('rightUpperLeg', riggedPose.RightUpperLeg);
            if (riggedPose.LeftUpperLeg) setRotation('leftUpperLeg', riggedPose.LeftUpperLeg);
        }
        if (captureSettings.trackLowerLeg) {
            if (riggedPose.RightLowerLeg) setRotation('rightLowerLeg', riggedPose.RightLowerLeg);
            if (riggedPose.LeftLowerLeg) setRotation('leftLowerLeg', riggedPose.LeftLowerLeg);
        }
        if (captureSettings.trackToes) {
            if (riggedPose.RightToes) setRotation('rightToes', riggedPose.RightToes);
            if (riggedPose.LeftToes) setRotation('leftToes', riggedPose.LeftToes);
        }
    }

    // Face Expressions & Eye Gaze
    if (captureSettings.trackFace) {
        if (riggedPose.Face) {
            const versionStr = String(vrm.meta?.metaVersion || '1');
            const isVrm1 = versionStr === '1' || versionStr.startsWith('1.');

            if (isVrm1 && vrm.expressionManager) {
                const expressionManager = vrm.expressionManager;
                if (riggedPose.Face.blinkLeft !== undefined) expressionManager.setValue('blinkLeft', riggedPose.Face.blinkLeft);
                if (riggedPose.Face.blinkRight !== undefined) expressionManager.setValue('blinkRight', riggedPose.Face.blinkRight);
                if (riggedPose.Face.mouthA !== undefined) expressionManager.setValue('aa', riggedPose.Face.mouthA);
                if (riggedPose.Face.mouthI !== undefined) expressionManager.setValue('ih', riggedPose.Face.mouthI);
                if (riggedPose.Face.mouthU !== undefined) expressionManager.setValue('ou', riggedPose.Face.mouthU);
                if (riggedPose.Face.mouthE !== undefined) expressionManager.setValue('ee', riggedPose.Face.mouthE);
                if (riggedPose.Face.mouthO !== undefined) expressionManager.setValue('oh', riggedPose.Face.mouthO);
            } else if (vrm.blendShapeProxy) {
                const blendShapeProxy = vrm.blendShapeProxy;
                if (riggedPose.Face.blinkLeft !== undefined) blendShapeProxy.setValue('blink_l', riggedPose.Face.blinkLeft);
                if (riggedPose.Face.blinkRight !== undefined) blendShapeProxy.setValue('blink_r', riggedPose.Face.blinkRight);
                if (riggedPose.Face.mouthA !== undefined) blendShapeProxy.setValue('a', riggedPose.Face.mouthA);
                if (riggedPose.Face.mouthI !== undefined) blendShapeProxy.setValue('i', riggedPose.Face.mouthI);
                if (riggedPose.Face.mouthU !== undefined) blendShapeProxy.setValue('u', riggedPose.Face.mouthU);
                if (riggedPose.Face.mouthE !== undefined) blendShapeProxy.setValue('e', riggedPose.Face.mouthE);
                if (riggedPose.Face.mouthO !== undefined) blendShapeProxy.setValue('o', riggedPose.Face.mouthO);
            }
            appliedPose.Face = riggedPose.Face;
        }

        // Eye Gaze
        if (riggedPose.Face && riggedPose.Face.eyeGazeX !== undefined && riggedPose.Face.eyeGazeY !== undefined) {
            const leftEye = vrm.humanoid.getNormalizedBoneNode('leftEye');
            const rightEye = vrm.humanoid.getNormalizedBoneNode('rightEye');
            const gazeYaw = riggedPose.Face.eyeGazeX * 0.3;
            const gazePitch = riggedPose.Face.eyeGazeY * 0.2;
            const eyeRotation = new THREE.Euler(gazePitch, gazeYaw, 0, 'XYZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(eyeRotation);
            if (leftEye) leftEye.quaternion.slerp(targetQuat, 0.5);
            if (rightEye) rightEye.quaternion.slerp(targetQuat, 0.5);
        }
    }

    return appliedPose;
};
