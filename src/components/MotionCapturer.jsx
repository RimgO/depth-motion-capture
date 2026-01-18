import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { Holistic } from '@mediapipe/holistic';
import * as Kalidokit from 'kalidokit';
import { Camera } from '@mediapipe/camera_utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Pause, Clock, X, SkipBack, SkipForward, Eye, EyeOff } from 'lucide-react';

// Import refactored modules
import { TIMING, SMOOTHING, COORDINATES } from '../constants/landmarks.js';
import { LowPassFilter, draw2DOverlay, generate3DLandmarks } from '../utils/landmarkProcessing.js';
import { 
    calculateArmRotations, 
    calculateBodyRotations, 
    applyTemporalSmoothing,
    mergeRiggedPose 
} from '../utils/poseCalculations.js';
import { calculateAllMetrics } from '../utils/metricsCalculator.js';
import { calculateHandRotations } from '../utils/handCalculations.js';
import { calculateFaceExpressions } from '../utils/faceCalculations.js';

// --- GLOBAL MEDIAPIPE SINGLETON ---
// This prevents multiple WASM initializations which cause the "Module.arguments" error.
let globalHolisticInstance = null;
let globalHolisticPromise = null;
let activeResultsCallback = null;
let globalDebugLogging = false; // Global flag for debug logging

const getGlobalHolistic = () => {
    if (globalHolisticPromise) return globalHolisticPromise;

    globalHolisticPromise = (async () => {
        console.log("Starting Global AI Engine (Holistic) initialization...");
        const holistic = new Holistic({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
        });

        holistic.setOptions({
            modelComplexity: 2,  // Higher complexity for better 3D estimation
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.7,  // Higher tracking confidence
            refineFaceLandmarks: true,
        });

        await holistic.initialize();

        holistic.onResults((results) => {
            // Debug: Check what results we're getting (if debug logging enabled)
            if (globalDebugLogging && Math.random() < 0.05) {
                console.log('[Holistic onResults]', {
                    hasPoseLandmarks: !!results.poseLandmarks,
                    hasPoseWorldLandmarks: !!results.poseWorldLandmarks,
                    hasZa: !!results.za,
                    hasLeftHandLandmarks: !!results.leftHandLandmarks,
                    hasRightHandLandmarks: !!results.rightHandLandmarks
                });
            }
            
            if (activeResultsCallback) {
                activeResultsCallback(results);
            } else {
                // Log when callback is not set (should only happen briefly during initialization)
                if (Math.random() < 0.01) {
                    console.warn('[Holistic] Results received but no activeResultsCallback set');
                }
            }
        });

        console.log("Global AI Engine (Holistic) Ready.");
        globalHolisticInstance = holistic;
        return holistic;
    })();

    return globalHolisticPromise;
};

// Global error suppression for SES "null" exceptions
if (typeof window !== 'undefined') {
    const handleNullError = (e) => {
        if (e && (e.reason === null || e.reason === undefined || e.message === "null")) {
            if (e.preventDefault) e.preventDefault();
            return true;
        }
    };
    window.addEventListener('unhandledrejection', handleNullError);
    window.addEventListener('error', handleNullError);
}

const MotionCapturer = ({ videoFile, vrmUrl, onActionDetected, onClearVideo, isRecording, captureSettings = {}, debugLogging = false, onDebugLoggingChange }) => {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const videoRef = useRef(null);
    const sceneRef = useRef(null);
    const vrmRef = useRef(null);
    const timeDisplayRef = useRef(null);
    const progressFillRef = useRef(null);
    const seekInputRef = useRef(null);
    const poseRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const propsRef = useRef({ onActionDetected, isRecording, captureSettings });
    const recordedDataRef = useRef([]);
    
    // Low-pass filters for each landmark
    const landmarkFiltersRef = useRef(null);
    const previousRiggedPoseRef = useRef(null);

    // Keep props fresh for the results handler
    useEffect(() => {
        propsRef.current = { onActionDetected, isRecording, captureSettings };
        globalDebugLogging = debugLogging; // Also update here
    }, [onActionDetected, isRecording, captureSettings, debugLogging]);
    
    // Initialize debug logging on mount
    useEffect(() => {
        globalDebugLogging = debugLogging;
    }, []); // Run once on mount

    const [loading, setLoading] = useState(false);
    const [hasVrm, setHasVrm] = useState(false);
    const [vrmVersion, setVrmVersion] = useState(null);
    const vrmVersionRef = useRef('1'); // Track VRM version in ref for closure access
    const [showNeuralPanel, setShowNeuralPanel] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [analysisLogs, setAnalysisLogs] = useState([
        { id: 1, time: '0.00s', msg: 'Neural link established.' },
        { id: 2, time: '0.05s', msg: 'Awaiting pose vectors...' }
    ]);
    const [currentIntent, setCurrentIntent] = useState('Standby');
    const [metrics, setMetrics] = useState({ confidence: 0, landmarks: 0, latency: 0, flux: 0, rigging: false });
    const [stabilityHistory, setStabilityHistory] = useState(new Array(30).fill(50));
    const [minimapLandmarks, setMinimapLandmarks] = useState([]);
    const [engineStatus, setEngineStatus] = useState('Initializing');
    const lastProcessTimeRef = useRef(Date.now());
    const lastUiUpdateRef = useRef(0);
    const lastActionEmitRef = useRef(0);
    const lastSuccessRef = useRef(Date.now());
    const recordingStartTimeRef = useRef(0);

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- INITIALIZE POSE ---
    useEffect(() => {
        let isInstanceDestroyed = false;

        const init = async () => {
            try {
                setAnalysisLogs(prev => [
                    { id: Date.now(), time: 'BOOT', msg: 'WASM Runtime: Requesting AI core...' },
                    ...prev
                ]);
                const holistic = await getGlobalHolistic();
                if (!isInstanceDestroyed) {
                    poseRef.current = holistic;
                    setAnalysisLogs(prev => [
                        { id: Date.now(), time: 'OK', msg: 'WASM Runtime: AI core established.' },
                        ...prev
                    ]);
                }
            } catch (e) {
                console.error("Pose Init Fail:", e);
                setAnalysisLogs(prev => [
                    { id: Date.now(), time: 'ERR', msg: 'WASM Runtime: Engine failed to boot.' },
                    ...prev
                ]);
            }
        };

        init();
        return () => { isInstanceDestroyed = true; };
    }, []);

    // --- THREE.JS INITIALIZATION (ONCE) ---
    useEffect(() => {
        if (!canvasRef.current || sceneRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x060608); // Subtle dark blue background
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
        camera.position.set(0, 0.9, 5.0);
        camera.lookAt(new THREE.Vector3(0, 0.9, 0));
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.9, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.update();

        const light = new THREE.DirectionalLight(0xffffff, 1.0);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const updateSize = () => {
            if (!canvasRef.current || !renderer || !camera) return;
            const container = canvasRef.current.parentElement;
            if (!container) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(canvasRef.current.parentElement);

        const clock = new THREE.Clock();
        let animId = null;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            if (vrmRef.current) vrmRef.current.update(clock.getDelta());
            controls.update();
            renderer.render(scene, camera);

            // Heartbeat
            const timeSinceLastResult = Date.now() - lastSuccessRef.current;
            if (timeSinceLastResult > TIMING.ENGINE_STALL_TIMEOUT && engineStatus === 'Running') {
                setEngineStatus('Stalled');
            }
        };
        animate();

        return () => {
            cancelAnimationFrame(animId);
            resizeObserver.disconnect();
            controls.dispose();
            renderer.dispose();
            sceneRef.current = null;
            rendererRef.current = null;
            cameraRef.current = null;
        };
    }, []);

    // --- SOURCE & CAPTURE LOGIC ---
    const animateVRM = (vrm, riggedPose, captureSettings) => {
        const appliedPose = {};

        const setRotation = (name, rotation, lerpAmount = SMOOTHING.VRM_BONE_SLERP) => {
            if (!vrm || !vrm.humanoid) return;
            const bone = vrm.humanoid.getNormalizedBoneNode(name);
            if (bone && rotation) {
                const targetQuat = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
                );
                bone.quaternion.slerp(targetQuat, lerpAmount);
                appliedPose[name] = rotation;
            }
        };

        // Core Body
        if (riggedPose.Hips) {
            const hips = vrm.humanoid.getNormalizedBoneNode('hips');
            if (hips) {
                // Adjust position scaling and offset
                // Mediapipe World coords are roughly meters, but origin is hip center.
                // VRM Hips are usually ~1.0m off ground.
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

        if (riggedPose.Spine) setRotation('spine', riggedPose.Spine);
        if (riggedPose.Chest) setRotation('chest', riggedPose.Chest);
        if (riggedPose.UpperChest) setRotation('upperChest', riggedPose.UpperChest);
        if (riggedPose.Neck) setRotation('neck', riggedPose.Neck);
        if (riggedPose.Head) setRotation('head', riggedPose.Head);

        // Shoulders (Clavicles) - Dampen for stability
        if (riggedPose.RightShoulder) {
            const rot = { ...riggedPose.RightShoulder };
            rot.z *= SMOOTHING.SHOULDER_Z_DAMPEN; // Reduce shrugging intensity
            setRotation('rightShoulder', rot);
        }
        if (riggedPose.LeftShoulder) {
            const rot = { ...riggedPose.LeftShoulder };
            rot.z *= SMOOTHING.SHOULDER_Z_DAMPEN;
            setRotation('leftShoulder', rot);
        }

        // Arms - Y-axis (twist) needs faster response
        if (riggedPose.RightUpperArm) {
            const rot = { ...riggedPose.RightUpperArm };
            // Apply Y-axis rotation with higher lerp for faster response
            if (rot.y !== undefined) {
                const bone = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
                if (bone) {
                    // Apply Y-axis with less smoothing for immediate twist feedback
                    const yQuat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(0, rot.y, 0, 'XYZ')
                    );
                    bone.quaternion.slerp(yQuat, 0.95); // Fast response for twist
                    
                    // Apply X and Z normally
                    const xzQuat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(rot.x || 0, 0, rot.z || 0, 'XYZ')
                    );
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
            // Apply Y-axis rotation with higher lerp for faster response
            if (rot.y !== undefined) {
                const bone = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
                if (bone) {
                    // Apply Y-axis with less smoothing for immediate twist feedback
                    const yQuat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(0, rot.y, 0, 'XYZ')
                    );
                    bone.quaternion.slerp(yQuat, 0.95); // Fast response for twist
                    
                    // Apply X and Z normally
                    const xzQuat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(rot.x || 0, 0, rot.z || 0, 'XYZ')
                    );
                    bone.quaternion.multiply(xzQuat);
                    appliedPose.leftUpperArm = rot;
                } else {
                    setRotation('leftUpperArm', rot);
                }
            } else {
                setRotation('leftUpperArm', rot);
            }
        }

        if (riggedPose.RightLowerArm) setRotation('rightLowerArm', riggedPose.RightLowerArm);
        if (riggedPose.LeftLowerArm) setRotation('leftLowerArm', riggedPose.LeftLowerArm);
        if (riggedPose.RightHand) setRotation('rightHand', riggedPose.RightHand);
        if (riggedPose.LeftHand) setRotation('leftHand', riggedPose.LeftHand);

        // Fingers - Use higher lerp for faster response (fingers need to move quickly)
        const fingerLerp = 0.9; // Faster response than body (0.8) for finger articulation
        
        // Fingers - Left Hand
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

        // Fingers - Right Hand
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

        // Legs (Conditional)
        if (captureSettings?.captureLowerBody) {
            if (riggedPose.RightUpperLeg) setRotation('rightUpperLeg', riggedPose.RightUpperLeg);
            if (riggedPose.LeftUpperLeg) setRotation('leftUpperLeg', riggedPose.LeftUpperLeg);
            if (riggedPose.RightLowerLeg) setRotation('rightLowerLeg', riggedPose.RightLowerLeg);
            if (riggedPose.LeftLowerLeg) setRotation('leftLowerLeg', riggedPose.LeftLowerLeg);
        }

        // Face Expressions (BlendShapes)
        if (riggedPose.Face) {
            const versionStr = String(vrmRef.current?.meta?.metaVersion || '1');
            const isVrm1 = versionStr === '1' || versionStr.startsWith('1.');

            if (isVrm1 && vrm.expressionManager) {
                // VRM 1.0: Use expressionManager
                const expressionManager = vrm.expressionManager;

                // Blink
                if (riggedPose.Face.blinkLeft !== undefined) {
                    expressionManager.setValue('blinkLeft', riggedPose.Face.blinkLeft);
                }
                if (riggedPose.Face.blinkRight !== undefined) {
                    expressionManager.setValue('blinkRight', riggedPose.Face.blinkRight);
                }

                // Mouth shapes (AIUEO)
                if (riggedPose.Face.mouthA !== undefined) {
                    expressionManager.setValue('aa', riggedPose.Face.mouthA);
                }
                if (riggedPose.Face.mouthI !== undefined) {
                    expressionManager.setValue('ih', riggedPose.Face.mouthI);
                }
                if (riggedPose.Face.mouthU !== undefined) {
                    expressionManager.setValue('ou', riggedPose.Face.mouthU);
                }
                if (riggedPose.Face.mouthE !== undefined) {
                    expressionManager.setValue('ee', riggedPose.Face.mouthE);
                }
                if (riggedPose.Face.mouthO !== undefined) {
                    expressionManager.setValue('oh', riggedPose.Face.mouthO);
                }

                appliedPose.Face = riggedPose.Face;
            } else if (vrm.blendShapeProxy) {
                // VRM 0.x: Use blendShapeProxy
                const blendShapeProxy = vrm.blendShapeProxy;

                // Blink
                if (riggedPose.Face.blinkLeft !== undefined) {
                    blendShapeProxy.setValue('blink_l', riggedPose.Face.blinkLeft);
                }
                if (riggedPose.Face.blinkRight !== undefined) {
                    blendShapeProxy.setValue('blink_r', riggedPose.Face.blinkRight);
                }

                // Mouth shapes (AIUEO)
                if (riggedPose.Face.mouthA !== undefined) {
                    blendShapeProxy.setValue('a', riggedPose.Face.mouthA);
                }
                if (riggedPose.Face.mouthI !== undefined) {
                    blendShapeProxy.setValue('i', riggedPose.Face.mouthI);
                }
                if (riggedPose.Face.mouthU !== undefined) {
                    blendShapeProxy.setValue('u', riggedPose.Face.mouthU);
                }
                if (riggedPose.Face.mouthE !== undefined) {
                    blendShapeProxy.setValue('e', riggedPose.Face.mouthE);
                }
                if (riggedPose.Face.mouthO !== undefined) {
                    blendShapeProxy.setValue('o', riggedPose.Face.mouthO);
                }

                appliedPose.Face = riggedPose.Face;
            }
        }

        // Eye Gaze - Apply rotation to eye bones
        if (riggedPose.Face && riggedPose.Face.eyeGazeX !== undefined && riggedPose.Face.eyeGazeY !== undefined) {
            const leftEye = vrm.humanoid.getNormalizedBoneNode('leftEye');
            const rightEye = vrm.humanoid.getNormalizedBoneNode('rightEye');
            
            // Convert gaze values (-1 to 1) to rotation angles
            // Horizontal: positive = look right, negative = look left
            // Vertical: positive = look down, negative = look up
            const gazeYaw = riggedPose.Face.eyeGazeX * 0.3;   // Max ~17 degrees
            const gazePitch = riggedPose.Face.eyeGazeY * 0.2; // Max ~11 degrees
            
            const eyeRotation = new THREE.Euler(gazePitch, gazeYaw, 0, 'XYZ');
            const targetQuat = new THREE.Quaternion().setFromEuler(eyeRotation);
            
            // Apply to both eyes with fast lerp for responsive eye movement
            if (leftEye) {
                leftEye.quaternion.slerp(targetQuat, 0.5);
            }
            if (rightEye) {
                rightEye.quaternion.slerp(targetQuat, 0.5);
            }
        }

        return appliedPose;
    };

    // --- SOURCE & CAPTURE LOGIC ---
    useEffect(() => {
        const resultsHandler = async (results) => {
            if (!results) {
                if (globalDebugLogging) {
                    console.log('[resultsHandler] Called but no results');
                }
                return;
            }

            // Log every 60 frames to avoid spam (if debug logging enabled)
            if (globalDebugLogging && Math.random() < TIMING.DEBUG_LOG_SAMPLE_RATE_RARE) {
                console.log('[resultsHandler] Processing pose data', {
                    hasPoseLandmarks: !!results.poseLandmarks,
                    hasPoseWorldLandmarks: !!results.poseWorldLandmarks,
                    hasZa: !!results.za,
                    hasVrm: !!vrmRef.current
                });
            }

            lastSuccessRef.current = Date.now();
            if (engineStatus !== 'Running') setEngineStatus('Running');

            // Draw 2D overlay using refactored utility
            draw2DOverlay(overlayRef, results);

            if (!results.poseLandmarks) return;
            const landmarks = results.poseLandmarks;

            // === DEBUG: Check if poseWorldLandmarks is available ===
            if (typeof window !== 'undefined' && !window._poseWorldLandmarksChecked) {
                console.log('=== MediaPipe Holistic Results Check ===');
                console.log('results keys:', Object.keys(results));
                console.log('poseWorldLandmarks exists?', results.poseWorldLandmarks !== undefined);
                console.log('poseWorldLandmarks type:', typeof results.poseWorldLandmarks);
                console.log('poseWorldLandmarks length:', results.poseWorldLandmarks?.length);
                
                // Check mysterious 'za' property
                console.log('--- Checking results.za ---');
                console.log('za exists?', results.za !== undefined);
                console.log('za type:', typeof results.za);
                if (results.za) {
                    console.log('za is array?', Array.isArray(results.za));
                    console.log('za length:', results.za?.length);
                    if (results.za.length > 0) {
                        console.log('Sample za[0]:', results.za[0]);
                        console.log('za[0] properties:', Object.keys(results.za[0] || {}));
                    }
                }
                
                if (results.poseWorldLandmarks && results.poseWorldLandmarks.length > 0) {
                    console.log('Sample poseWorldLandmarks[0]:', results.poseWorldLandmarks[0]);
                    console.log('Has x/y/z properties?', {
                        x: results.poseWorldLandmarks[0].x,
                        y: results.poseWorldLandmarks[0].y,
                        z: results.poseWorldLandmarks[0].z,
                        visibility: results.poseWorldLandmarks[0].visibility
                    });
                }
                console.log('==========================================');
                window._poseWorldLandmarksChecked = true;
            }

            const vrm = vrmRef.current;
            if (vrm && vrm.scene && vrm.scene.parent) {
                try {
                    // MediaPipe Holistic provides 3D world landmarks via 'za' property (internal naming)
                    // This contains real 3D coordinates from the pose estimation model
                    let worldLandmarks = results.za || results.poseWorldLandmarks;
                    
                    if (!worldLandmarks && landmarks) {
                        // Initialize filters on first frame
                        if (!landmarkFiltersRef.current) {
                            landmarkFiltersRef.current = landmarks.map(() => new LowPassFilter(SMOOTHING.LANDMARK_FILTER));
                        }
                        
                        // Use refactored function to generate pseudo-3D landmarks
                        worldLandmarks = generate3DLandmarks(landmarks, landmarkFiltersRef.current);
                    }
                    
                    if (!worldLandmarks) {
                        console.warn('[Pose Calculation] No world landmarks available');
                        return;
                    }
                    
                    // Use refactored functions to calculate pose
                    let riggedPose = null;
                    
                    if (worldLandmarks && worldLandmarks.length >= 17) {
                        // Prepare hand landmarks for arm twist detection
                        const handLandmarksForArm = {
                            leftHandLandmarks: results.leftHandLandmarks || null,
                            rightHandLandmarks: results.rightHandLandmarks || null
                        };
                        
                        // Calculate arm and body rotations using refactored modules
                        // Pass VRM version to handle coordinate system differences
                        // Use ref to get latest version (avoiding closure issues)
                        const currentVrmVersion = vrmVersionRef.current;
                        console.log('[resultsHandler] Passing vrmVersion to calculateArmRotations:', currentVrmVersion);
                        const armPose = calculateArmRotations(worldLandmarks, handLandmarksForArm, currentVrmVersion);
                        const bodyPose = calculateBodyRotations(worldLandmarks);
                        
                        // Calculate hand rotations (finger bones)
                        const handPose = calculateHandRotations(results);
                        
                        // Calculate face expressions (BlendShapes)
                        const facePose = results.faceLandmarks ? calculateFaceExpressions(results.faceLandmarks) : null;
                        
                        // Merge poses (including hand and face)
                        riggedPose = mergeRiggedPose(armPose, bodyPose, handPose);
                        
                        // Add face expressions to riggedPose
                        if (facePose) {
                            riggedPose.Face = facePose;
                            
                            // Log eye gaze data every 60 frames for debugging (if enabled)
                            if (globalDebugLogging && Math.random() < TIMING.DEBUG_LOG_SAMPLE_RATE_RARE) {
                                console.log('[Eye Gaze]', {
                                    horizontal: facePose.eyeGazeX?.toFixed(3),
                                    vertical: facePose.eyeGazeY?.toFixed(3),
                                    blinkLeft: facePose.blinkLeft?.toFixed(3),
                                    blinkRight: facePose.blinkRight?.toFixed(3)
                                });
                            }
                        }
                    }
                    
                    if (riggedPose) {
                        // Apply temporal smoothing using refactored function
                        riggedPose = applyTemporalSmoothing(riggedPose, previousRiggedPoseRef.current);
                        previousRiggedPoseRef.current = JSON.parse(JSON.stringify(riggedPose)); // Deep copy

                        const finalPose = animateVRM(vrm, riggedPose, propsRef.current.captureSettings);
                        vrm._lastRigTime = Date.now();

                        // Record Data (Skip first 1s)
                        const isCurrentlyRecording = propsRef.current.isRecording;
                        const timeSinceStart = Date.now() - recordingStartTimeRef.current;

                        if (isCurrentlyRecording) {
                            if (timeSinceStart > TIMING.RECORDING_WARMUP) {
                                recordedDataRef.current.push({
                                    t: Date.now(),
                                    input: riggedPose,
                                    output: finalPose,
                                    rawLandmarks: landmarks,
                                    worldLandmarks: worldLandmarks
                                });
                                // Log every 30 frames to avoid console spam
                                if (recordedDataRef.current.length % TIMING.RECORDING_LOG_INTERVAL === 1) {
                                    console.log(`[Recording] Collecting data... ${recordedDataRef.current.length} frames`);
                                }
                            } else {
                                // Only log once when waiting
                                if (timeSinceStart > 900 && timeSinceStart < 1100) {
                                    console.log(`[Recording] Waiting for warmup... (${timeSinceStart}ms elapsed)`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Kalidokit Solve Error:", e);
                }
            }

            const nowTime = Date.now();
            if (nowTime - lastUiUpdateRef.current > TIMING.UI_UPDATE_THROTTLE) {
                lastUiUpdateRef.current = nowTime;
                
                // Use refactored metrics calculator
                const metrics = calculateAllMetrics({
                    landmarks,
                    currentTime: nowTime,
                    lastProcessTime: lastProcessTimeRef.current,
                    vrm: vrmRef.current
                });
                
                setMetrics(metrics);
                setStabilityHistory(prev => [...prev.slice(1), metrics.confidence]);
                setMinimapLandmarks(landmarks.map(l => ({ x: l.x, y: l.y })));

                if (propsRef.current.onActionDetected && (nowTime - lastActionEmitRef.current > TIMING.ACTION_EMIT_DEBOUNCE)) {
                    lastActionEmitRef.current = nowTime;
                    propsRef.current.onActionDetected(landmarks);
                }
            }
            lastProcessTimeRef.current = nowTime;
        };

        console.log('[MotionCapturer] Registering activeResultsCallback');
        activeResultsCallback = resultsHandler;
        return () => {
            console.log('[MotionCapturer] Unregistering activeResultsCallback');
            activeResultsCallback = null;
        };
    }, []);

    // VRM Loading Effect
    useEffect(() => {
        let isEffectDestroyed = false;
        if (!vrmUrl || !sceneRef.current) return;

        const loadVRMInternal = async (url) => {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));
            setLoading(true);
            loader.load(url, (gltf) => {
                if (isEffectDestroyed) return;
                const vrm = gltf.userData.vrm;
                if (vrmRef.current) sceneRef.current.remove(vrmRef.current.scene);
                
                // Detect VRM version
                const version = String(vrm.meta?.metaVersion || '1');
                setVrmVersion(version);
                vrmVersionRef.current = version; // Update ref for immediate access
                console.log('VRM Version detected:', version);
                
                // VRM version-dependent model rotation:
                // VRM 0.x: Front is -Z, rotate 180° to face camera
                // VRM 1.0: Front is +Z (glTF standard), no rotation needed
                const versionStr = String(version);
                const isVrm0 = versionStr.startsWith('0');
                vrm.scene.rotation.y = isVrm0 ? Math.PI : 0;
                
                sceneRef.current.add(vrm.scene);
                vrmRef.current = vrm;
                
                setLoading(false);
                setHasVrm(true);
            }, undefined, (error) => {
                console.error("VRM Load Error:", error);
                setLoading(false);
            });
        };

        loadVRMInternal(vrmUrl);
        return () => { isEffectDestroyed = true; };
    }, [vrmUrl]);

    // Sensing Logic Effect
    useEffect(() => {
        let isEffectDestroyed = false;
        let cameraProcess = null;
        let animationFrameId = null;

        const startSensing = async () => {
            if (videoFile && videoRef.current) {
                videoRef.current.src = videoFile;
                videoRef.current.play();
                const loop = async () => {
                    if (isEffectDestroyed) return;
                    const holistic = poseRef.current || await getGlobalHolistic();
                    poseRef.current = holistic;
                    if (videoRef.current && !videoRef.current.paused) await holistic.send({ image: videoRef.current });
                    animationFrameId = requestAnimationFrame(loop);
                };
                loop();
            } else if (videoRef.current) {
                cameraProcess = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (isEffectDestroyed) return;
                        const holistic = poseRef.current || await getGlobalHolistic();
                        poseRef.current = holistic;
                        if (videoRef.current) await holistic.send({ image: videoRef.current });
                    },
                    width: 640, height: 480
                });
                cameraProcess.start();
            }
        };

        startSensing();

        return () => {
            isEffectDestroyed = true;
            if (cameraProcess) cameraProcess.stop();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [videoFile]);

    // Force resize when hasVrm state changes (to handle layout shifts)
    useEffect(() => {
        if (hasVrm) {
            // Give layout a moment to settle for framer-motion
            const timer = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [hasVrm]);

    const togglePlayback = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const stepFrame = (forward = true) => {
        if (videoRef.current) {
            const frameTime = 1 / 30; // Assume 30 FPS
            videoRef.current.currentTime += forward ? frameTime : -frameTime;
        }
    };

    const cyclePlaybackRate = () => {
        const rates = [1, 1.5, 2, 0.5];
        const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
        setPlaybackRate(nextRate);
        if (videoRef.current) {
            videoRef.current.playbackRate = nextRate;
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayback();
            } else if (e.code === 'ArrowRight') {
                stepFrame(true);
            } else if (e.code === 'ArrowLeft') {
                stepFrame(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playbackRate]); // Re-bind if necessary, though togglePlayback/stepFrame use refs or current state

    // Recording Control Effect
    useEffect(() => {
        console.log(`[Recording Effect] isRecording=${isRecording}, bufferLength=${recordedDataRef.current.length}`);

        if (!isRecording && recordedDataRef.current.length > 0) {
            // Stop recording triggered -> Download
            console.log("[Recording] Stop triggered, processing data...");
            const allData = recordedDataRef.current;

            if (allData.length === 0) {
                console.log("[Recording] No data recorded.");
                recordedDataRef.current = [];
                return;
            }

            console.log(`[Recording] Total frames collected: ${allData.length}`);

            // Get the actual time range from the recorded data
            const firstTimestamp = allData[0].t;
            const lastTimestamp = allData[allData.length - 1].t;

            console.log(`[Recording] Time range: ${firstTimestamp} to ${lastTimestamp} (duration: ${(lastTimestamp - firstTimestamp) / 1000}s)`);

            // Skip first 1s and last 1s based on actual recording timestamps
            const startCutoff = firstTimestamp + 1000;
            const endCutoff = lastTimestamp - 1000;

            const filteredData = allData.filter(d => d.t >= startCutoff && d.t <= endCutoff);

            console.log(`[Recording] After trimming: ${filteredData.length} frames`);

            if (filteredData.length > 0) {
                console.log("[Recording] Creating download...");
                const dataStr = JSON.stringify(filteredData, null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `motion-debug-log-${Date.now()}.json`;
                a.style.display = 'none';
                document.body.appendChild(a);
                console.log("[Recording] Triggering download click...");
                a.click();

                // Delay cleanup to ensure download completes
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log("[Recording] Cleanup completed");
                }, 100);

                console.log(`✅ Motion data downloaded (Trimmed start/end 1s): ${filteredData.length} frames from ${allData.length} total`);
            } else {
                console.log("⚠️ Recording too short after trimming (less than 2 seconds).");
            }
            recordedDataRef.current = []; // Clear buffer
        } else if (isRecording) {
            // Start recording
            recordedDataRef.current = [];
            recordingStartTimeRef.current = Date.now();
            console.log("🔴 Recording started...");
        } else {
            console.log("[Recording] Effect triggered but no action taken (not recording, buffer empty)");
        }
    }, [isRecording]);



    return (
        <div className="relative w-full h-full overflow-hidden bg-[#050505] flex">
            {/* Main VRM Viewing Area (Side-by-side Split) */}
            <motion.div
                animate={{
                    width: hasVrm ? '50%' : '0%',
                    left: hasVrm ? '50%' : '100%',
                    opacity: hasVrm ? 1 : 0
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="absolute inset-y-0 z-20 bg-[#08080a] overflow-hidden"
            >
                <canvas ref={canvasRef} className="w-full h-full" />

                {hasVrm && (
                    <div className="absolute top-6 left-6 z-30 flex flex-col gap-2">
                        <div className="px-3 py-1 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 text-[10px] font-bold text-blue-400 rounded-full uppercase tracking-widest shadow-lg w-fit">
                            Digital Twin Active
                        </div>
                        <div className="px-2 py-1 bg-black/40 backdrop-blur-sm border border-white/5 text-[8px] text-white/40 rounded-lg uppercase tracking-tighter w-fit">
                            Drag to Rotate • Right Click to Pan • Scroll to Zoom
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Video & Pose Sensing Area (Maximally Large) */}
            <motion.div
                animate={{
                    width: hasVrm ? '50%' : '100%',
                    height: '100%',
                    left: '0px',
                    borderColor: hasVrm ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)'
                }}
                className="absolute inset-y-0 overflow-hidden border-r z-20 bg-black"
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                <div className="relative w-full h-full group">
                    <video
                        ref={videoRef}
                        className={`w-full h-full object-cover ${videoFile ? "" : "scale-x-[-1]"}`}
                        playsInline
                        muted
                        onLoadedMetadata={(e) => setDuration(e.target.duration)}
                    />
                    <canvas
                        ref={overlayRef}
                        className={`absolute inset-0 w-full h-full pointer-events-none ${videoFile ? "" : "scale-x-[-1]"}`}
                        width={640}
                        height={480}
                    />

                    {/* Video Controls Overlay (Visible for video files) */}
                    {videoFile && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-8 gap-4 pointer-events-auto">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={togglePlayback}
                                        className="p-4 bg-cyan-500 text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] z-20"
                                    >
                                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
                                    </button>

                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] font-bold tracking-widest uppercase bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                                                    <Clock size={10} />
                                                    <span ref={timeDisplayRef}>{formatTime(0)} / {formatTime(duration)}</span>
                                                </div>
                                                <button
                                                    onClick={cyclePlaybackRate}
                                                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/50 hover:text-cyan-400 border border-white/10 rounded uppercase transition-colors"
                                                >
                                                    {playbackRate}x Speed
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 px-2 border border-white/10 backdrop-blur-sm">
                                                    <button
                                                        onClick={() => stepFrame(false)}
                                                        className="hover:text-cyan-400 transition-colors p-1"
                                                        title="Previous Frame"
                                                    >
                                                        <SkipBack size={14} />
                                                    </button>
                                                    <div className="w-[1px] h-3 bg-white/10" />
                                                    <button
                                                        onClick={() => stepFrame(true)}
                                                        className="hover:text-cyan-400 transition-colors p-1"
                                                        title="Next Frame"
                                                    >
                                                        <SkipForward size={14} />
                                                    </button>
                                                </div>
                                                <div className="hidden sm:block text-white/20 font-mono text-[9px] font-bold tracking-[0.2em]">
                                                    ENGINE_V2_SYNC
                                                </div>
                                                {onClearVideo && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onClearVideo();
                                                        }}
                                                        className="p-1.5 hover:bg-red-500/20 rounded-full text-white/30 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30"
                                                        title="Close Video"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="relative h-6 flex items-center group/seeker">
                                            <input
                                                ref={seekInputRef}
                                                id="seeker-bar"
                                                type="range"
                                                min="0"
                                                max={duration || 100}
                                                step="0.001"
                                                defaultValue="0"
                                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 z-10 transition-all hover:h-2"
                                                onMouseDown={() => setIsSeeking(true)}
                                                onMouseUp={() => setIsSeeking(false)}
                                                onTouchStart={() => setIsSeeking(true)}
                                                onTouchEnd={() => setIsSeeking(false)}
                                                onInput={(e) => {
                                                    if (videoRef.current) {
                                                        const time = parseFloat(e.target.value);
                                                        videoRef.current.currentTime = time;
                                                        if (progressFillRef.current) {
                                                            progressFillRef.current.style.width = `${(time / (duration || 1)) * 100}%`;
                                                        }
                                                    }
                                                }}
                                            />
                                            <div
                                                ref={progressFillRef}
                                                className="absolute left-0 h-1.5 bg-gradient-to-r from-cyan-600 via-cyan-400 to-white rounded-lg pointer-events-none transition-all group-hover/seeker:h-2 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                                                style={{ width: '0%' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute top-6 left-6 flex items-center gap-3">
                        <div className="px-3 py-1 bg-cyan-500 text-[10px] font-extrabold text-black rounded-full uppercase tracking-tighter shadow-xl">
                            {videoFile ? 'Video Analysis' : (hasVrm ? 'Neural Capture View' : 'Direct AI Sensing')}
                        </div>
                        <div className="px-3 py-1 bg-white/5 backdrop-blur-xl text-[10px] font-bold text-white/60 rounded-full uppercase border border-white/10">
                            {videoFile ? 'Manual Scrubbing' : '60FPS Low Latency'}
                        </div>
                        <button
                            onClick={() => setShowNeuralPanel(!showNeuralPanel)}
                            className="px-3 py-1 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-colors text-[10px] font-bold text-white/60 hover:text-cyan-400 rounded-full uppercase border border-white/10 flex items-center gap-2 pointer-events-auto"
                            title={showNeuralPanel ? 'Hide Neural Panel' : 'Show Neural Panel'}
                        >
                            {showNeuralPanel ? <EyeOff size={12} /> : <Eye size={12} />}
                            <span>Panel</span>
                        </button>
                        {onDebugLoggingChange && (
                            <button
                                onClick={() => onDebugLoggingChange(!debugLogging)}
                                className={`px-3 py-1 backdrop-blur-xl hover:bg-white/10 transition-colors text-[10px] font-bold rounded-full uppercase border flex items-center gap-2 pointer-events-auto ${
                                    debugLogging 
                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
                                        : 'bg-white/5 text-white/60 border-white/10 hover:text-cyan-400'
                                }`}
                                title={debugLogging ? 'Disable Debug Logging' : 'Enable Debug Logging'}
                            >
                                <Activity size={12} />
                                <span>Logs</span>
                            </button>
                        )}
                    </div>

                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]" />

                    {/* AI Monitoring Panel */}
                    <AnimatePresence>
                        {showNeuralPanel && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="absolute top-24 left-6 z-30 w-64 flex flex-col gap-4 pointer-events-none"
                            >
                        <div className="flex flex-col gap-1">
                            <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] font-mono blur-[0.2px] drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">AI Monitoring</h4>
                            <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/50 to-transparent" />
                        </div>

                        <div className="flex flex-col gap-3">
                            <div>
                                <h5 className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Live Analysis</h5>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${engineStatus === 'Running' ? (metrics.rigging ? 'bg-green-500' : 'bg-cyan-500') :
                                        engineStatus === 'Stalled' ? 'bg-amber-500' : 'bg-white/20'
                                        } animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]`} />
                                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-tight">
                                        {engineStatus === 'Running' ? (metrics.rigging ? 'Neural Link Synced' : 'System Active') :
                                            engineStatus === 'Stalled' ? 'Neural Stream Stalled' : 'Engine Warming Up...'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h5 className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Current Intent</h5>
                                <motion.div
                                    key={currentIntent}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[11px] font-black text-white italic tracking-tight flex items-center gap-2"
                                >
                                    <span className="w-1 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDuration: '0.8s' }} />
                                    {currentIntent}...
                                </motion.div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-white/5 p-2 rounded-lg border border-white/5 backdrop-blur-md">
                                <div className="flex flex-col">
                                    <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Confidence</span>
                                    <div className="flex items-end gap-1">
                                        <span className="text-sm font-mono font-bold text-cyan-400 leading-none">{metrics.confidence}%</span>
                                        <div className="flex-1 h-1 bg-white/10 rounded-full mb-1 overflow-hidden">
                                            <motion.div
                                                className="h-full bg-cyan-500"
                                                animate={{ width: `${metrics.confidence}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Latency</span>
                                    <div className="flex items-end gap-1">
                                        <span className="text-sm font-mono font-bold text-blue-400 leading-none">{metrics.latency}ms</span>
                                    </div>
                                </div>
                                <div className="flex flex-col col-span-2 border-t border-white/5 pt-2">
                                    <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter mb-1">Engine Telemetry</span>
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col flex-1">
                                            <span className="text-[6px] text-cyan-500/60 uppercase font-bold">WASM/SIMD</span>
                                            <div className="h-0.5 bg-cyan-500/20 rounded-full mt-0.5" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-[6px] text-blue-500/60 uppercase font-bold">WebGL 2.0</span>
                                            <div className="h-0.5 bg-blue-500/20 rounded-full mt-0.5" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-[6px] text-purple-500/60 uppercase font-bold">Flux: {metrics.flux}</span>
                                            <div className="h-0.5 bg-purple-500/20 rounded-full mt-0.5" />
                                        </div>
                                    </div>
                                    {vrmVersion && (
                                        <div className="mt-2 pt-2 border-t border-white/5">
                                            <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter mr-2">VRM</span>
                                            <span className={`text-[8px] font-mono font-bold tracking-tight ${
                                                vrmVersion === '1' || vrmVersion.startsWith('1.') ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                                v{vrmVersion}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col col-span-2 mt-1 border-t border-white/5 pt-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Signal Integrity</span>
                                        <span className="text-[7px] text-blue-500 font-mono tracking-tighter">Live Waveform</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-8 flex-1 bg-blue-500/5 rounded border border-blue-500/10 overflow-hidden relative">
                                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                <motion.path
                                                    d={`M ${stabilityHistory.map((v, i) => `${(i / (stabilityHistory.length - 1)) * 100},${100 - v}`).join(' L ')}`}
                                                    fill="transparent"
                                                    stroke="#3b82f6"
                                                    strokeWidth="2"
                                                    initial={false}
                                                    animate={{ d: `M ${stabilityHistory.map((v, i) => `${(i / (stabilityHistory.length - 1)) * 100},${100 - v}`).join(' L ')}` }}
                                                    transition={{ duration: 0.1 }}
                                                />
                                                <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                                </linearGradient>
                                                <path
                                                    d={`M 0,100 L ${stabilityHistory.map((v, i) => `${(i / (stabilityHistory.length - 1)) * 100},${100 - v}`).join(' L ')} L 100,100 Z`}
                                                    fill="url(#waveGrad)"
                                                />
                                            </svg>
                                        </div>
                                        {minimapLandmarks.length > 0 && (
                                            <div className="w-8 h-8 bg-cyan-500/5 rounded border border-cyan-500/10 relative overflow-hidden shrink-0">
                                                <svg className="w-full h-full" viewBox="0 0 1 1">
                                                    {minimapLandmarks.map((l, i) => (
                                                        <circle key={i} cx={l.x} cy={l.y} r="0.02" fill="#22d3ee" fillOpacity="0.6" />
                                                    ))}
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col col-span-2 mt-1 border-t border-white/5 pt-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Neural Stream</span>
                                        <span className="text-[7px] text-cyan-500/60 font-mono tracking-tighter">{metrics.landmarks} nodes</span>
                                    </div>
                                    <div className="h-4 flex items-center justify-between gap-[1px]">
                                        {[...Array(24)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    height: [
                                                        `${Math.random() * 100}%`,
                                                        `${Math.random() * 100}%`,
                                                        `${Math.random() * 100}%`
                                                    ],
                                                    backgroundColor: i % 4 === 0 ? '#22d3ee' : '#1e40af'
                                                }}
                                                transition={{
                                                    repeat: Infinity,
                                                    duration: 0.5 + Math.random(),
                                                    ease: "easeInOut"
                                                }}
                                                className="flex-1 rounded-full opacity-50"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <h5 className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Analysis Log</h5>
                                <div className="flex flex-col gap-1 max-h-48 overflow-hidden mask-fade-bottom">
                                    <AnimatePresence initial={false}>
                                        {analysisLogs.map((log) => (
                                            <motion.div
                                                key={log.id}
                                                initial={{ opacity: 0, x: -10, height: 0 }}
                                                animate={{ opacity: 1, x: 0, height: 'auto' }}
                                                exit={{ opacity: 0 }}
                                                className="flex gap-2 font-mono text-[9px] leading-tight"
                                            >
                                                <span className="text-cyan-500/60 shrink-0">[{log.time}]</span>
                                                <span className="text-white/70">{log.msg}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-2xl z-50 px-8"
                    >
                        <div className="flex flex-col items-center gap-8 max-w-sm text-center">
                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-cyan-500/10 rounded-full"></div>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    className="absolute top-0 w-24 h-24 border-4 border-cyan-500 border-t-transparent rounded-full shadow-[0_0_50px_rgba(6,182,212,0.5)]"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Activity size={32} className="text-cyan-400 animate-pulse" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter italic">Neural Link Initiated</h3>
                                <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Synchronizing motion vectors...</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!hasVrm && !loading && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center z-30 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/80 backdrop-blur-2xl px-10 py-6 rounded-[40px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                    >
                        <h2 className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-fill-transparent mb-2 uppercase tracking-tighter italic">System Standby</h2>
                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">Upload a VRM model to activate sync</p>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default MotionCapturer;
