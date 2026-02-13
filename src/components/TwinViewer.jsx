import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRM, VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { animateVRM } from '../utils/vrmAnimator';

const TwinViewer = () => {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const vrmRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("Waiting for connection...");

    // 2. Define VRM Loader Logic
    const loadVRM = useCallback((url) => {
        if (!sceneRef.current) return;
        setLoading(true);
        setStatus("Loading VRM...");

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(
            url,
            (gltf) => {
                const vrm = gltf.userData.vrm;
                if (!vrm) {
                    console.error('Not a VRM');
                    setStatus("Error: Not a VRM file");
                    setLoading(false);
                    return;
                }

                if (vrmRef.current) {
                    sceneRef.current.remove(vrmRef.current.scene);
                    VRMUtils.deepDispose(vrmRef.current.scene);
                }

                vrmRef.current = vrm;
                sceneRef.current.add(vrm.scene);

                // Rotate if VRM0
                const version = vrm.meta?.metaVersion || '1';
                if (String(version).startsWith('0')) {
                    vrm.scene.rotation.y = Math.PI;
                } else {
                    vrm.scene.rotation.y = 0;
                }

                console.log('VRM Loaded in Twin');
                setLoading(false);
                setStatus("Ready");
            },
            (progress) => {
                // Optional: update progress
            },
            (err) => {
                console.error(err);
                setLoading(false);
                setStatus("Failed to load VRM");
            }
        );
    }, []);

    // 1. Initialize Three.js Scene
    useEffect(() => {
        if (!canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x060608);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
        camera.position.set(0, 0.9, 5.0);
        camera.lookAt(0, 0.9, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.9, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        const light = new THREE.DirectionalLight(0xffffff, 1.0);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Animation Loop
        const clock = new THREE.Clock();
        let frameId;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            if (vrmRef.current) vrmRef.current.update(clock.getDelta());
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (!camera || !renderer) return;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
            // controls.dispose(); // OrbitControls needs explicit disposal if created this way? Check docs. Usually fine.
        };
    }, []);

    // 3. Broadcast Channel Listener
    useEffect(() => {
        const channel = new BroadcastChannel('motion_capture_channel');

        channel.onmessage = (event) => {
            const { type, payload } = event.data;

            if (type === 'POSE_UPDATE') {
                if (vrmRef.current && payload.pose) {
                    animateVRM(vrmRef.current, payload.pose, payload.settings || {});
                }
            } else if (type === 'LOAD_VRM_URL') {
                loadVRM(payload.url);
            } else if (type === 'LOAD_VRM_BLOB') {
                // Re-create blob url
                const blob = new Blob([payload.blobData], { type: 'model/gltf-binary' }); // Assuming GLB/VRM
                const url = URL.createObjectURL(blob);
                loadVRM(url);
            }
        };

        // Notify main window we are accessible
        channel.postMessage({ type: 'TWIN_READY' });

        return () => {
            channel.close();
        };
    }, [loadVRM]);

    return (
        <div className="w-screen h-screen bg-[#0a0a0c] overflow-hidden relative">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Minimal Status Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none opacity-50">
                {status}
            </div>
        </div>
    );
};

export default TwinViewer;
