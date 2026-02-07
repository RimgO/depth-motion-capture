import * as Kalidokit from 'kalidokit';

export const calculateHandRotations = (results) => {
    const { leftHandLandmarks, rightHandLandmarks } = results;
    let handPose = {};

    if (leftHandLandmarks) {
        const leftRig = Kalidokit.Hand.solve(leftHandLandmarks, "Left");
        handPose = { ...handPose, ...leftRig };
    }

    if (rightHandLandmarks) {
        const rightRig = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
        handPose = { ...handPose, ...rightRig };
    }

    return handPose;
};
