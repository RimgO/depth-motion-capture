import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import * as Kalidokit from 'kalidokit';
import { Camera } from '@mediapipe/camera_utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Play, Pause, Clock, X, SkipBack, SkipForward } from 'lucide-react';

// --- GLOBAL MEDIAPIPE SINGLETON ---
// This prevents multiple WASM initializations which cause the "Module.arguments" error.
let globalPoseInstance = null;
let globalPosePromise = null;
let activeResultsCallback = null;

const getGlobalPose = () => {
    if (globalPosePromise) return globalPosePromise;

    globalPosePromise = (async () => {
        console.log("Starting Global AI Engine initialization...");
        const pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        await pose.initialize();

        pose.onResults((results) => {
            if (activeResultsCallback) {
                activeResultsCallback(results);
            }
        });

        console.log("Global AI Engine Ready.");
        globalPoseInstance = pose;
        return pose;
    })();

    return globalPosePromise;
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

const MotionCapturer = ({ videoFile, vrmUrl, onActionDetected, onClearVideo }) => {
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
    const propsRef = useRef({ onActionDetected });

    // Keep props fresh for the results handler
    useEffect(() => {
        propsRef.current = { onActionDetected };
    }, [onActionDetected]);

    const [loading, setLoading] = useState(false);
    const [hasVrm, setHasVrm] = useState(false);
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
                const pose = await getGlobalPose();
                if (!isInstanceDestroyed) {
                    poseRef.current = pose;
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
            if (timeSinceLastResult > 2000 && engineStatus === 'Running') {
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
    const animateVRM = (vrm, riggedPose) => {
        const setRotation = (name, rotation, lerpAmount = 0.8) => {
            if (!vrm || !vrm.humanoid) return;
            const bone = vrm.humanoid.getNormalizedBoneNode(name);
            if (bone && rotation) {
                const targetQuat = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(rotation.x, rotation.y, rotation.z, 'YXZ')
                );
                bone.quaternion.slerp(targetQuat, lerpAmount);
            }
        };

        if (riggedPose.UpperChest) setRotation('upperChest', riggedPose.UpperChest);
        if (riggedPose.Chest) setRotation('chest', riggedPose.Chest);
        if (riggedPose.Neck) setRotation('neck', riggedPose.Neck);
        if (riggedPose.Head) setRotation('head', riggedPose.Head);

        if (riggedPose.Hips) {
            const hips = vrm.humanoid.getNormalizedBoneNode('hips');
            if (hips) {
                hips.position.set(
                    -riggedPose.Hips.worldPosition.x,
                    riggedPose.Hips.worldPosition.y + 1.0,
                    -riggedPose.Hips.worldPosition.z
                );
                if (riggedPose.Hips.rotation) {
                    setRotation('hips', riggedPose.Hips.rotation);
                }
            }
        }

        if (riggedPose.RightUpperArm) setRotation('rightUpperArm', riggedPose.RightUpperArm);
        if (riggedPose.LeftUpperArm) setRotation('leftUpperArm', riggedPose.LeftUpperArm);
        if (riggedPose.RightLowerArm) setRotation('rightLowerArm', riggedPose.RightLowerArm);
        if (riggedPose.LeftLowerArm) setRotation('leftLowerArm', riggedPose.LeftLowerArm);
        if (riggedPose.RightHand) setRotation('rightHand', riggedPose.RightHand);
        if (riggedPose.LeftHand) setRotation('leftHand', riggedPose.LeftHand);
        if (riggedPose.RightUpperLeg) setRotation('rightUpperLeg', riggedPose.RightUpperLeg);
        if (riggedPose.LeftUpperLeg) setRotation('leftUpperLeg', riggedPose.LeftUpperLeg);
        if (riggedPose.RightLowerLeg) setRotation('rightLowerLeg', riggedPose.RightLowerLeg);
        if (riggedPose.LeftLowerLeg) setRotation('leftLowerLeg', riggedPose.LeftLowerLeg);
    };

    // --- SOURCE & CAPTURE LOGIC ---
    useEffect(() => {
        const resultsHandler = async (results) => {
            if (!results) return;
            lastSuccessRef.current = Date.now();
            if (engineStatus !== 'Running') setEngineStatus('Running');

            if (overlayRef.current && results.poseLandmarks) {
                const canvasCtx = overlayRef.current.getContext('2d');
                canvasCtx.save();
                canvasCtx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
                drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
                drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ff0077', lineWidth: 1, radius: 3 });
                canvasCtx.restore();
            }

            if (!results.poseLandmarks) return;
            const landmarks = results.poseLandmarks;

            const vrm = vrmRef.current;
            if (vrm && vrm.scene && vrm.scene.parent && results.poseWorldLandmarks) {
                try {
                    const riggedPose = Kalidokit.Pose.solve(landmarks, results.poseWorldLandmarks, {
                        runtime: "mediapipe",
                        video: videoRef.current,
                        enableSmoothing: true
                    });
                    if (riggedPose) {
                        animateVRM(vrm, riggedPose);
                        vrm._lastRigTime = Date.now();
                    }
                } catch (e) {
                    console.error("Kalidokit Solve Error:", e);
                }
            }

            const nowTime = Date.now();
            if (nowTime - lastUiUpdateRef.current > 66) {
                lastUiUpdateRef.current = nowTime;
                const avgConfidence = landmarks.reduce((acc, curr) => acc + (curr.visibility || 0), 0) / landmarks.length;
                setMetrics({
                    confidence: Math.round(avgConfidence * 100),
                    landmarks: landmarks.length,
                    latency: nowTime - lastProcessTimeRef.current,
                    flux: Math.round((landmarks.length * 1000) / (nowTime - lastProcessTimeRef.current || 1)),
                    rigging: vrmRef.current && (Date.now() - (vrmRef.current._lastRigTime || 0) < 500)
                });
                setStabilityHistory(prev => [...prev.slice(1), avgConfidence * 100]);
                setMinimapLandmarks(landmarks.map(l => ({ x: l.x, y: l.y })));

                if (propsRef.current.onActionDetected && (nowTime - lastActionEmitRef.current > 200)) {
                    lastActionEmitRef.current = nowTime;
                    propsRef.current.onActionDetected(landmarks);
                }
            }
            lastProcessTimeRef.current = nowTime;
        };

        activeResultsCallback = resultsHandler;
        return () => { activeResultsCallback = null; };
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
                vrm.scene.rotation.y = Math.PI;
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
                    const pose = poseRef.current || await getGlobalPose();
                    poseRef.current = pose;
                    if (videoRef.current && !videoRef.current.paused) await pose.send({ image: videoRef.current });
                    animationFrameId = requestAnimationFrame(loop);
                };
                loop();
            } else if (videoRef.current) {
                cameraProcess = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (isEffectDestroyed) return;
                        const pose = poseRef.current || await getGlobalPose();
                        poseRef.current = pose;
                        if (videoRef.current) await pose.send({ image: videoRef.current });
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
                    </div>

                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]" />

                    {/* AI Monitoring Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
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
