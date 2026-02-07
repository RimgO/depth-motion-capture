import * as Kalidokit from 'kalidokit';

export const calculateFaceExpressions = (faceLandmarks, options = {}) => {
    if (!faceLandmarks) return null;

    try {
        const faceRig = Kalidokit.Face.solve(faceLandmarks, {
            runtime: 'mediapipe',
            imageSize: options.imageSize || { width: 640, height: 480 }
        });
        return faceRig;
    } catch (e) {
        console.error("Face Solve Error", e);
        return null;
    }
};
