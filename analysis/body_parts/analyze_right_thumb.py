#!/usr/bin/env python3
"""
Analyze right thumb rotation angles from motion capture log
"""

import json
import os
import glob
from pathlib import Path

def analyze_right_thumb():
    # Find latest log file
    log_files = sorted(glob.glob('motion-debug-log-*.json') + glob.glob('log/motion-debug-log-*.json'), 
                      key=os.path.getmtime, reverse=True)
    
    if not log_files:
        print("❌ No log files found")
        return
    
    log_file = log_files[0]
    print(f"📁 Analyzing: {log_file}\n")
    
    with open(log_file, 'r') as f:
        data = json.load(f)
    
    # Handle both array and object formats
    frames = data if isinstance(data, list) else data.get('frames', [])
    print(f"📊 Total frames: {len(frames)}\n")
    
    if not frames:
        print("❌ No frames in log")
        return
    
    # Collect right thumb angles
    thumb_bones = [
        'rightThumbProximal',
        'rightThumbIntermediate', 
        'rightThumbDistal'
    ]
    
    thumb_data = {bone: {'x': [], 'z': []} for bone in thumb_bones}
    
    for frame in frames:
        rotations = frame.get('input', {})  # Use 'input' instead of 'rotations'
        for bone in thumb_bones:
            if bone in rotations:
                rot = rotations[bone]
                thumb_data[bone]['x'].append(rot['x'])
                thumb_data[bone]['z'].append(rot['z'])
    
    # Show first 10 frames (thumb closed state)
    print("=" * 70)
    print("🔍 Right Thumb - First 10 frames (closed state)")
    print("=" * 70)
    print(f"{'Frame':<8} {'Proximal Z':<15} {'Intermediate Z':<15} {'Distal Z':<15}")
    print("-" * 70)
    
    for i in range(min(10, len(frames))):
        rots = frames[i].get('input', {})  # Use 'input' instead of 'rotations'
        prox_z = rots.get('rightThumbProximal', {}).get('z', 0)
        inter_z = rots.get('rightThumbIntermediate', {}).get('z', 0)
        distal_z = rots.get('rightThumbDistal', {}).get('z', 0)
        
        print(f"{i:<8} {prox_z:>7.3f} ({prox_z*57.3:>5.1f}°) "
              f"{inter_z:>7.3f} ({inter_z*57.3:>5.1f}°) "
              f"{distal_z:>7.3f} ({distal_z*57.3:>5.1f}°)")
    
    print("\n" + "=" * 70)
    print("📈 Right Thumb - Angle Statistics (all frames)")
    print("=" * 70)
    
    for bone in thumb_bones:
        if not thumb_data[bone]['z']:
            continue
            
        z_vals = thumb_data[bone]['z']
        x_vals = thumb_data[bone]['x']
        
        z_min = min(z_vals)
        z_max = max(z_vals)
        z_avg = sum(z_vals) / len(z_vals)
        
        x_min = min(x_vals)
        x_max = max(x_vals)
        x_avg = sum(x_vals) / len(x_vals)
        
        print(f"\n{bone}:")
        print(f"  Z-axis (bend): {z_min:.3f} ~ {z_max:.3f} rad ({z_min*57.3:.1f}° ~ {z_max*57.3:.1f}°)")
        print(f"             avg: {z_avg:.3f} rad ({z_avg*57.3:.1f}°)")
        print(f"  X-axis (spread): {x_min:.3f} ~ {x_max:.3f} rad ({x_min*57.3:.1f}° ~ {x_max*57.3:.1f}°)")
        print(f"               avg: {x_avg:.3f} rad ({x_avg*57.3:.1f}°)")
    
    # Compare with other fingers (right hand)
    print("\n" + "=" * 70)
    print("🔄 Comparison: Right Thumb vs Other Fingers (Proximal bones)")
    print("=" * 70)
    
    other_fingers = [
        'rightIndexProximal',
        'rightMiddleProximal',
        'rightRingProximal',
        'rightLittleProximal'
    ]
    
    other_z_vals = []
    other_x_vals = []
    
    for frame in frames:
        rots = frame.get('input', {})  # Use 'input' instead of 'rotations'
        for finger in other_fingers:
            if finger in rots:
                other_z_vals.append(rots[finger]['z'])
                other_x_vals.append(rots[finger]['x'])
    
    if thumb_data['rightThumbProximal']['z'] and other_z_vals:
        thumb_z_avg = sum(thumb_data['rightThumbProximal']['z']) / len(thumb_data['rightThumbProximal']['z'])
        thumb_x_avg = sum(thumb_data['rightThumbProximal']['x']) / len(thumb_data['rightThumbProximal']['x'])
        other_z_avg = sum(other_z_vals) / len(other_z_vals)
        other_x_avg = sum(other_x_vals) / len(other_x_vals)
        
        print(f"Thumb Proximal  - Z avg: {thumb_z_avg:>6.3f} rad ({thumb_z_avg*57.3:>6.1f}°)")
        print(f"                  X avg: {thumb_x_avg:>6.3f} rad ({thumb_x_avg*57.3:>6.1f}°)")
        print(f"Other Fingers   - Z avg: {other_z_avg:>6.3f} rad ({other_z_avg*57.3:>6.1f}°)")
        print(f"                  X avg: {other_x_avg:>6.3f} rad ({other_x_avg*57.3:>6.1f}°)")
    
    # Check if thumb Z is negative when closed (first 10 frames)
    print("\n" + "=" * 70)
    print("✅ Diagnosis")
    print("=" * 70)
    
    if thumb_data['rightThumbProximal']['z']:
        first_10_z = thumb_data['rightThumbProximal']['z'][:10]
        all_positive = all(z > 0 for z in first_10_z)
        all_negative = all(z < 0 for z in first_10_z)
        
        if all_positive:
            print("⚠️  Z軸が常に正（指を閉じても正のまま）")
            print("    → 親指が閉じた時に負の値になるべき")
        elif all_negative:
            print("✅ Z軸が負（指を閉じた状態で正しい）")
        else:
            print("⚠️  Z軸が混在（正と負の両方）")
            print(f"    → 最初の10フレーム: {[f'{z:.2f}' for z in first_10_z]}")

if __name__ == '__main__':
    analyze_right_thumb()
