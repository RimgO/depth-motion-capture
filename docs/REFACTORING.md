# Refactoring Plan

This document outlines necessary refactoring tasks to improve maintainability, performance, and readability of the Motion Capture application.

## 2026-02-07 Update: Progress Report

### Completed Tasks ✅
- **Decompose `MotionCapturer.jsx`**:
    - [x] **Extract `useHolistic` Hook**: Moved MediaPipe initialization and event handling to `src/hooks/useHolistic.js`.
    - [x] **Extract Calculation Logic**: Created `src/utils/poseCalculations.js`, `handCalculations.js`, and `faceCalculations.js` to handle extensive math.
- **Centralize Configuration**:
    - [x] Created `src/constants/landmarks.js` for magic numbers and smoothing factors.
- **Feature Requests**:
    - [x] **GLB Support**: Application now accepts `.glb` files alongside `.vrm`.
    - [x] **Granular Body Tracking**: Added UI toggles to enable/disable specific body parts (Face, Spine, Arms, Legs, Fingers) for debugging.
    - [x] **Fix T-Pose Issue**: Restored and consolidated Kalidokit solver logic into the new utility files.

### Remaining Tasks / Known Issues ⚠️

1.  **Extract `useVRMScene` Hook**:
    - The Three.js scene setup, camera loop, and VRM loading logic still reside inside `MotionCapturer.jsx`. This should be extracted to `src/hooks/useVRMScene.js` to further reduce component size.

2.  **UI Component Extraction**:
    - `NeuralPanel` (the debug overlay) and `VideoOverlay` are still inline JSX. These should be moved to separate files in `src/components/`.

3.  **State Management Optimization**:
    - `MotionCapturer` still uses many individual `useState` hooks. Consolidating these into a `useReducer` would be cleaner.

4.  **Type Safety (TypeScript)**:
    - The project remains in JavaScript. Migration to TypeScript is highly recommended to catch `undefined` bone or landmark errors at build time.

5.  **Performance Tuning**:
    - The `calculatePose` function runs every frame. While efficient, we should profile it to ensure it doesn't block the main thread on lower-end devices. Web Workers could be considered for offloading MediaPipe processing.

## Original Plan (Reference)

### 1. Decompose `MotionCapturer.jsx`
The `MotionCapturer` component has grown too large (~1400 lines) and violates the Single Responsibility Principle. It currently handles:
- specific Three.js scene setup
- Mediapipe Holistic integration
- React UI state
- Recording logic
- Landmark calculations

**Action Plan:**
- **Extract `useHolistic` Hook**: Move all Mediapipe initialization and event handling logic into a custom hook. (DONE)
- **Extract `useVRMScene` Hook**: Encapsulate Three.js scene creation, camera setup, and VRM loading.
- **Extract UI Components**:
    - `NeuralPanel`: The large debug overlay should be its own component.
    - `VideoOverlay`: The video and canvas elements should be separated.

### 2. State Management Optimization
Currently, `MotionCapturer` uses many individual `useState` hooks, causing potentially unnecessary re-renders.
**Action Plan:**
- Group related state (e.g., `metrics`, `logs`, `status`) into a single `useReducer` or context.
- Use `useMemo` for heavy calculations like `metrics` derived from landmarks.

### 3. Centralize Configuration
Magic numbers are scattered throughout the code (e.g., smoothing factors, camera positions, timing constants).
**Action Plan:**
- Create `src/config/constants.js` for all tunable parameters. (DONE - `src/constants/landmarks.js`)
- Move animation smoothing values (`lerpAmount`) to this config.

### 4. Improve Git Workflow
Recent merge conflicts suggest a need for better modularity to avoid multiple developers (or agents) touching the same large file simultaneously.
**Action Plan:**
- Splitting `MotionCapturer.jsx` will naturally specific conflict risks.

### 5. Type Safety
The project uses JavaScript. Migrating to TypeScript would prevent many runtime errors related to `undefined` bone nodes or missing landmarks.
**Action Plan:**
- Incremental adoption of JSDoc or eventual migration to `.tsx`.
