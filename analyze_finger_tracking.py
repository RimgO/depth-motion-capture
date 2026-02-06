#!/usr/bin/env python3
import json
import math

with open('log/motion-debug-log-1768665889464.json', 'r') as f:
    data = json.load(f)

print('=' * 70)
print('指トラッキング分析')
print('=' * 70)
print(f'総フレーム数: {len(data)}\n')

# 各指のZ軸回転（曲げ）を分析
fingers = {
    'right': {
        'thumb': ['rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal'],
        'index': ['rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal'],
        'middle': ['rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal'],
        'ring': ['rightRingProximal', 'rightRingIntermediate', 'rightRingDistal'],
        'little': ['rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal']
    },
    'left': {
        'thumb': ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal'],
        'index': ['leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal'],
        'middle': ['leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal'],
        'ring': ['leftRingProximal', 'leftRingIntermediate', 'leftRingDistal'],
        'little': ['leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal']
    }
}

# 各指の統計を収集
for hand_name, hand_fingers in fingers.items():
    print(f'\n【{hand_name.upper()}】')
    
    for finger_name, bones in hand_fingers.items():
        print(f'\n  {finger_name.capitalize()}:')
        
        for bone in bones:
            z_values = []
            for frame in data:
                if 'input' in frame and bone in frame['input']:
                    z = frame['input'][bone].get('z')
                    if z is not None:
                        z_values.append(z)
            
            if z_values:
                min_z = min(z_values)
                max_z = max(z_values)
                range_z = max_z - min_z
                
                # 変化が大きいフレームをカウント
                large_changes = 0
                for i in range(1, len(z_values)):
                    if abs(z_values[i] - z_values[i-1]) > 0.1:
                        large_changes += 1
                
                print(f'    {bone:25s}: {min_z:6.2f} ~ {max_z:6.2f} rad '
                      f'(範囲: {range_z:5.2f} rad = {math.degrees(range_z):5.1f}°) '
                      f'大変化: {large_changes}回')

# 最も変化が大きい指を特定
print('\n' + '=' * 70)
print('変化範囲トップ5（指を立てた動きの検出）')
print('=' * 70)

all_ranges = []
for hand_name, hand_fingers in fingers.items():
    for finger_name, bones in hand_fingers.items():
        for bone in bones:
            z_values = []
            for frame in data:
                if 'input' in frame and bone in frame['input']:
                    z = frame['input'][bone].get('z')
                    if z is not None:
                        z_values.append(z)
            
            if z_values:
                range_z = max(z_values) - min(z_values)
                all_ranges.append((bone, range_z, hand_name, finger_name))

all_ranges.sort(key=lambda x: x[1], reverse=True)

for i, (bone, range_z, hand, finger) in enumerate(all_ranges[:10], 1):
    print(f'{i:2d}. {bone:30s} ({hand} {finger:7s}): {range_z:5.2f} rad = {math.degrees(range_z):6.1f}°')

# フレーム間の変化速度を分析
print('\n' + '=' * 70)
print('変化速度分析（指を立てる速さ）')
print('=' * 70)

max_speed_per_finger = {}
for hand_name, hand_fingers in fingers.items():
    for finger_name, bones in hand_fingers.items():
        finger_key = f'{hand_name}_{finger_name}'
        max_speed = 0
        
        for bone in bones:
            z_values = []
            for frame in data:
                if 'input' in frame and bone in frame['input']:
                    z = frame['input'][bone].get('z')
                    if z is not None:
                        z_values.append(z)
            
            for i in range(1, len(z_values)):
                speed = abs(z_values[i] - z_values[i-1])
                max_speed = max(max_speed, speed)
        
        max_speed_per_finger[finger_key] = max_speed

print('\n各指の最大変化速度（1フレーム間）:')
for finger_key, speed in sorted(max_speed_per_finger.items(), key=lambda x: x[1], reverse=True):
    hand, finger = finger_key.split('_')
    print(f'  {hand:5s} {finger:7s}: {speed:.4f} rad/frame = {math.degrees(speed):6.2f}°/frame')

# 診断
print('\n' + '=' * 70)
print('診断')
print('=' * 70)

avg_range = sum(r[1] for r in all_ranges) / len(all_ranges)
avg_speed = sum(max_speed_per_finger.values()) / len(max_speed_per_finger)

print(f'\n平均変化範囲: {avg_range:.3f} rad ({math.degrees(avg_range):.1f}°)')
print(f'平均最大速度: {avg_speed:.4f} rad/frame ({math.degrees(avg_speed):.2f}°/frame)')

if avg_range < 0.5:  # 約30度以下
    print('\n⚠️ 問題: 指の変化範囲が小さい')
    print('   原因候補:')
    print('   1. 手のランドマーク検出精度が低い')
    print('   2. 指の曲げ角度の計算方法に問題')
    print('   3. スケール係数が小さすぎる')
elif avg_speed < 0.05:  # 約3度/フレーム以下
    print('\n⚠️ 問題: 指の変化速度が遅い（スムージング過剰）')
    print('   原因候補:')
    print('   1. Temporal smoothingが強すぎる')
    print('   2. VRM slerp係数が低すぎる')
    print('   3. 複数段階のスムージングが累積')
else:
    print('\n✅ 指のトラッキングデータは良好')
    print('   問題はVRMへの適用段階にある可能性')
