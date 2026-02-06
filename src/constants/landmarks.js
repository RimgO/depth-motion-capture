/**
 * MediaPipe Pose Landmark Indices
 * Reference: https://google.github.io/mediapipe/solutions/pose.html
 */
export const POSE_LANDMARKS = {
    // Face
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    
    // Shoulders
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    
    // Elbows
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    
    // Wrists
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    
    // Hands
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    
    // Hips
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    
    // Knees
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    
    // Ankles
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    
    // Feet
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

/**
 * MediaPipe Hand Landmark Indices (21 points per hand)
 * Reference: https://google.github.io/mediapipe/solutions/hands.html
 */
export const HAND_LANDMARKS = {
    // Wrist
    WRIST: 0,
    
    // Thumb (4 joints)
    THUMB_CMC: 1,        // Carpometacarpal
    THUMB_MCP: 2,        // Metacarpophalangeal
    THUMB_IP: 3,         // Interphalangeal
    THUMB_TIP: 4,
    
    // Index finger (4 joints)
    INDEX_FINGER_MCP: 5,  // Metacarpophalangeal
    INDEX_FINGER_PIP: 6,  // Proximal interphalangeal
    INDEX_FINGER_DIP: 7,  // Distal interphalangeal
    INDEX_FINGER_TIP: 8,
    
    // Middle finger (4 joints)
    MIDDLE_FINGER_MCP: 9,
    MIDDLE_FINGER_PIP: 10,
    MIDDLE_FINGER_DIP: 11,
    MIDDLE_FINGER_TIP: 12,
    
    // Ring finger (4 joints)
    RING_FINGER_MCP: 13,
    RING_FINGER_PIP: 14,
    RING_FINGER_DIP: 15,
    RING_FINGER_TIP: 16,
    
    // Pinky finger (4 joints)
    PINKY_MCP: 17,
    PINKY_PIP: 18,
    PINKY_DIP: 19,
    PINKY_TIP: 20
};

/**
 * MediaPipe Face Landmark Indices (468 points)
 * Reference: https://google.github.io/mediapipe/solutions/face_mesh.html
 * Key landmarks for facial expression detection
 */
export const FACE_LANDMARKS = {
    // Left Eye (for blink detection)
    LEFT_EYE_UPPER: 159,
    LEFT_EYE_LOWER: 145,
    LEFT_EYE_INNER: 133,
    LEFT_EYE_OUTER: 33,
    LEFT_EYE_TOP: 159,
    LEFT_EYE_BOTTOM: 23,
    
    // Right Eye (for blink detection)
    RIGHT_EYE_UPPER: 386,
    RIGHT_EYE_LOWER: 374,
    RIGHT_EYE_INNER: 362,
    RIGHT_EYE_OUTER: 263,
    RIGHT_EYE_TOP: 386,
    RIGHT_EYE_BOTTOM: 253,
    
    // Mouth (for AIUEO vowel shapes)
    MOUTH_TOP: 13,
    MOUTH_BOTTOM: 14,
    MOUTH_LEFT: 61,
    MOUTH_RIGHT: 291,
    UPPER_LIP_TOP: 0,
    LOWER_LIP_BOTTOM: 17,
    MOUTH_LEFT_CORNER: 61,
    MOUTH_RIGHT_CORNER: 291,
    
    // Inner mouth
    INNER_MOUTH_TOP: 13,
    INNER_MOUTH_BOTTOM: 14,
    
    // Iris (for eye gaze tracking)
    LEFT_IRIS_CENTER: 468,
    RIGHT_IRIS_CENTER: 473,
    
    // Face outline (for head orientation)
    FACE_LEFT: 234,
    FACE_RIGHT: 454,
    FACE_TOP: 10,
    FACE_BOTTOM: 152
};

/**
 * VRM BlendShape Names
 * Mapping between calculation results and VRM expression names
 */
export const VRM_BLENDSHAPE_NAMES = {
    // VRM 1.0 Expression Names
    V1: {
        BLINK_LEFT: 'blinkLeft',
        BLINK_RIGHT: 'blinkRight',
        BLINK: 'blink',
        MOUTH_A: 'aa',      // "あ" mouth open
        MOUTH_I: 'ih',      // "い" smile/wide
        MOUTH_U: 'ou',      // "う" lips forward
        MOUTH_E: 'ee',      // "え" slight smile
        MOUTH_O: 'oh',      // "お" mouth O shape
        LOOK_LEFT: 'lookLeft',
        LOOK_RIGHT: 'lookRight',
        LOOK_UP: 'lookUp',
        LOOK_DOWN: 'lookDown'
    },
    
    // VRM 0.x BlendShape Preset Names (from VRMSchema)
    V0: {
        BLINK_L: 'blink_l',
        BLINK_R: 'blink_r',
        BLINK: 'blink',
        A: 'a',
        I: 'i',
        U: 'u',
        E: 'e',
        O: 'o',
        LOOKUP: 'lookup',
        LOOKDOWN: 'lookdown',
        LOOKLEFT: 'lookleft',
        LOOKRIGHT: 'lookright'
    }
};

/**
 * VRM Hand Bone Names
 * Maps to VRM Humanoid bone structure
 */
export const VRM_HAND_BONES = {
    // Left hand bones
    LEFT_HAND: 'leftHand',
    LEFT_THUMB_PROXIMAL: 'leftThumbProximal',
    LEFT_THUMB_INTERMEDIATE: 'leftThumbIntermediate',
    LEFT_THUMB_DISTAL: 'leftThumbDistal',
    LEFT_INDEX_PROXIMAL: 'leftIndexProximal',
    LEFT_INDEX_INTERMEDIATE: 'leftIndexIntermediate',
    LEFT_INDEX_DISTAL: 'leftIndexDistal',
    LEFT_MIDDLE_PROXIMAL: 'leftMiddleProximal',
    LEFT_MIDDLE_INTERMEDIATE: 'leftMiddleIntermediate',
    LEFT_MIDDLE_DISTAL: 'leftMiddleDistal',
    LEFT_RING_PROXIMAL: 'leftRingProximal',
    LEFT_RING_INTERMEDIATE: 'leftRingIntermediate',
    LEFT_RING_DISTAL: 'leftRingDistal',
    LEFT_LITTLE_PROXIMAL: 'leftLittleProximal',
    LEFT_LITTLE_INTERMEDIATE: 'leftLittleIntermediate',
    LEFT_LITTLE_DISTAL: 'leftLittleDistal',
    
    // Right hand bones
    RIGHT_HAND: 'rightHand',
    RIGHT_THUMB_PROXIMAL: 'rightThumbProximal',
    RIGHT_THUMB_INTERMEDIATE: 'rightThumbIntermediate',
    RIGHT_THUMB_DISTAL: 'rightThumbDistal',
    RIGHT_INDEX_PROXIMAL: 'rightIndexProximal',
    RIGHT_INDEX_INTERMEDIATE: 'rightIndexIntermediate',
    RIGHT_INDEX_DISTAL: 'rightIndexDistal',
    RIGHT_MIDDLE_PROXIMAL: 'rightMiddleProximal',
    RIGHT_MIDDLE_INTERMEDIATE: 'rightMiddleIntermediate',
    RIGHT_MIDDLE_DISTAL: 'rightMiddleDistal',
    RIGHT_RING_PROXIMAL: 'rightRingProximal',
    RIGHT_RING_INTERMEDIATE: 'rightRingIntermediate',
    RIGHT_RING_DISTAL: 'rightRingDistal',
    RIGHT_LITTLE_PROXIMAL: 'rightLittleProximal',
    RIGHT_LITTLE_INTERMEDIATE: 'rightLittleIntermediate',
    RIGHT_LITTLE_DISTAL: 'rightLittleDistal'
};

/**
 * Timing constants for throttling and debouncing
 */
export const TIMING = {
    // UI update throttle (milliseconds)
    UI_UPDATE_THROTTLE: 66, // ~15 FPS for UI updates
    
    // Action detection debounce (milliseconds)
    ACTION_EMIT_DEBOUNCE: 200,
    
    // Recording warm-up offset (milliseconds)
    RECORDING_WARMUP: 1000,
    
    // Engine stall timeout (milliseconds)
    ENGINE_STALL_TIMEOUT: 2000,
    
    // Frame logging sample rate (probability)
    DEBUG_LOG_SAMPLE_RATE: 0.02, // 2% of frames
    DEBUG_LOG_SAMPLE_RATE_RARE: 0.016, // ~1/60 frames
    
    // Rigging check window (milliseconds)
    RIGGING_ACTIVE_WINDOW: 500,
    
    // Recording sample logging interval (frames)
    RECORDING_LOG_INTERVAL: 30
};

/**
 * Smoothing factors for different processing stages
 */
export const SMOOTHING = {
    // Low-pass filter smoothing for raw landmarks
    LANDMARK_FILTER: 0.8,
    
    // Temporal smoothing for rigged pose rotations
    // Reduced from 0.5 to 0.3 for better responsiveness
    POSE_TEMPORAL: 0.3,
    
    // Quaternion slerp amount for VRM bone application
    // Increased from 0.8 to 0.9 for faster tracking
    VRM_BONE_SLERP: 0.9,
    
    // Shoulder rotation dampening
    SHOULDER_Z_DAMPEN: 0.5
};

/**
 * Depth estimation coefficients for pseudo-3D landmark generation
 */
export const DEPTH_ESTIMATION = {
    // Vertical component multiplier for arm depth
    ARM_VERTICAL_DEPTH: 1.5,
    
    // Lateral extension depth contribution
    ARM_LATERAL_DEPTH: 1.0,
    
    // Arm bend contribution to forward projection
    ARM_BEND_DEPTH: 0.6,
    
    // Forward reach indicator weight
    ARM_FORWARD_REACH: 0.5,
    
    // Elbow height multiplier
    ELBOW_HEIGHT_DEPTH: 1.2,
    
    // Elbow lateral distance weight
    ELBOW_LATERAL_DEPTH: 0.8,
    
    // Elbow mid-position depth offset
    ELBOW_MID_DEPTH: 0.2,
    
    // Shoulder reference depth
    SHOULDER_DEPTH: -0.05,
    
    // Hip reference depth
    HIP_DEPTH: -0.1,
    
    // Head/face depth coefficient
    HEAD_DEPTH_COEF: 0.3,
    
    // Default Y-based depth variation
    DEFAULT_Y_DEPTH: -0.2
};

/**
 * Coordinate normalization constants
 */
export const COORDINATES = {
    // Normalize 2D landmarks to [-1, 1] range
    NORMALIZE_X_SCALE: 2.0,
    NORMALIZE_Y_SCALE: 2.0,
    
    // Center offset for normalization
    CENTER_OFFSET: 0.5,
    
    // VRM hip Y-axis offset (meters above ground)
    VRM_HIP_Y_OFFSET: 1.0,
    
    // Hip rotation Z-axis scale
    HIP_ROTATION_Z_SCALE: 2.0,
    
    // Spine rotation Z-axis scale
    SPINE_ROTATION_Z_SCALE: 1.0
};

/**
 * Angle calculation constants
 */
export const ANGLES = {
    // Pi/2 offset for VRM arm Z-axis rotation
    // Increased from π/2 to π/2 + 0.4 to raise arm baseline position
    ARM_Z_OFFSET: Math.PI / 2 + 0.4,
    
    // X-axis rotation scale for arm tilt
    // Increased to 1.2 for full forward/backward range
    ARM_X_SCALE: 1.2,
    
    // Degrees to radians conversion
    DEG_TO_RAD: Math.PI / 180,
    
    // Radians to degrees conversion
    RAD_TO_DEG: 180 / Math.PI
};
