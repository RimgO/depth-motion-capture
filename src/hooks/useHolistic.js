import { Holistic } from '@mediapipe/holistic';
import { useEffect, useRef, useState } from 'react';

// Global singleton key to prevent multiple WASM initializations during HMR
const GLOBAL_HOLISTIC_KEY = '__MOTION_CAPTURE_HOLISTIC_INSTANCE__';

const getGlobalHolistic = () => {
    if (typeof window !== 'undefined' && window[GLOBAL_HOLISTIC_KEY]) {
        return window[GLOBAL_HOLISTIC_KEY];
    }

    const holisticPromise = (async () => {
        console.log("Starting Global AI Engine (Holistic) initialization...");
        const holistic = new Holistic({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
        });

        holistic.setOptions({
            modelComplexity: 2,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.7,
            refineFaceLandmarks: true,
        });

        await holistic.initialize();
        console.log("Global AI Engine (Holistic) Ready.");
        return holistic;
    })();

    if (typeof window !== 'undefined') {
        window[GLOBAL_HOLISTIC_KEY] = holisticPromise;
    }
    return holisticPromise;
};

export const useHolistic = (onResultsCallback) => {
    const poseRef = useRef(null);
    const [engineStatus, setEngineStatus] = useState('Initializing');

    useEffect(() => {
        let isActive = true;

        const init = async () => {
            try {
                const holistic = await getGlobalHolistic();
                if (!isActive) return;

                poseRef.current = holistic;
                setEngineStatus('Running');

                // We need to attach the callback carefully since holistic is global
                // Ideally, holistic.onResults supports multiple listeners, but standard MP implementation replaces it.
                // For this refactor, we assume single active listener or we'd need an event bus.
                holistic.onResults((results) => {
                    if (isActive && onResultsCallback) {
                        onResultsCallback(results);
                    }
                });
            } catch (e) {
                console.error("Holistic Init Error:", e);
                setEngineStatus('Error');
            }
        };

        init();
        return () => { isActive = false; };
    }, [onResultsCallback]);

    return { poseRef, engineStatus };
};
