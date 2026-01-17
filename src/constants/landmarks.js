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
    POSE_TEMPORAL: 0.5,
    
    // Quaternion slerp amount for VRM bone application
    VRM_BONE_SLERP: 0.8,
    
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
    ARM_Z_OFFSET: Math.PI / 2,
    
    // X-axis rotation scale for arm tilt
    ARM_X_SCALE: 0.5,
    
    // Degrees to radians conversion
    DEG_TO_RAD: Math.PI / 180,
    
    // Radians to degrees conversion
    RAD_TO_DEG: 180 / Math.PI
};
