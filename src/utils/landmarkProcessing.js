
export class LowPassFilter {
    constructor(alpha) {
        this.alpha = alpha || 0.5;
        this.y = null;
        this.s = null;
    }

    filter(value) {
        if (this.y === null) {
            const result = value;
            this.y = result;
            this.s = result;
            return result;
        }

        let result = (this.alpha * value) + ((1.0 - this.alpha) * this.s);
        this.y = result;
        this.s = result;
        return result;
    }

    filterWithAlpha(value, alpha) {
        this.alpha = alpha;
        return this.filter(value);
    }

    hasValue() {
        return this.y !== null;
    }

    reset() {
        this.y = null;
        this.s = null;
    }
}

import { POSE_CONNECTIONS, HAND_CONNECTIONS, FACEMESH_TESSELATION } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

export const draw2DOverlay = (overlayRef, results) => {
    if (!overlayRef.current || !results.poseLandmarks) return;

    const canvasCtx = overlayRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    // Draw pose
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ff0077', lineWidth: 1, radius: 3 });

    // Draw hands
    if (results.leftHandLandmarks) {
        drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, { color: '#00ff00', lineWidth: 1 });
        drawLandmarks(canvasCtx, results.leftHandLandmarks, { color: '#00ff00', lineWidth: 1, radius: 2 });
    }
    if (results.rightHandLandmarks) {
        drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, { color: '#ff00ff', lineWidth: 1 });
        drawLandmarks(canvasCtx, results.rightHandLandmarks, { color: '#ff00ff', lineWidth: 1, radius: 2 });
    }

    canvasCtx.restore();
};

export const generate3DLandmarks = (landmarks, filters) => {
    if (!landmarks || !filters) return null;

    // Pseudo-3D generation logic for z-axis estimation based on scale
    // This is a simplified fallback if 'za' (worldLandmarks) is missing
    return landmarks.map((l, i) => {
        const filter = filters[i];
        const z = filter ? filter.filter(l.z || 0) : (l.z || 0);
        return { x: l.x, y: l.y, z: z, visibility: l.visibility };
    });
};
