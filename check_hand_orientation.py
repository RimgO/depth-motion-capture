#!/usr/bin/env python3
import json
import math

with open('log/motion-debug-log-1768666469538.json', 'r') as f:
    data = json.load(f)

print('=' * 70)
print('指の角度詳細分析（X軸: 広げ、Z軸: 曲げ）')
print('=' * 70)

# 最初の数フレームで右手の指の値を確認
print('\n右手の指の角度（最初の3フレーム）:')
for frame_idx in range(min(3, len(data))):
    frame = data[frame_idx]
    if 'input' not in frame:
        continue
    
    print(f'\nFrame {frame_idx}:')
    
    # 右手の各指のProximal（根元）のX軸とZ軸を確認
    fingers = ['Index', 'Middle', 'Ring', 'Little', 'Thumb']
    for finger in fingers:
        bone_name = f'right{finger}Proximal'
        if bone_name in frame['input']:
            rot = frame['input'][bone_name]
            x = rot.get('x', 0)
            z = rot.get('z', 0)
            print(f'  {finger:7s} Proximal: X={x:7.3f} ({math.degrees(x):6.1f}°), '
                  f'Z={z:7.3f} ({math.degrees(z):6.1f}°)')

# Z軸の値の統計（指を立てた vs 曲げた）
print('\n' + '=' * 70)
print('Z軸の値の範囲（負 = 曲げた？、正 = 伸ばした？）')
print('=' * 70)

z_values_by_finger = {}
for hand in ['right', 'left']:
    for finger in ['Thumb', 'Index', 'Middle', 'Ring', 'Little']:
        for bone in ['Proximal', 'Intermediate', 'Distal']:
            bone_name = f'{hand}{finger}{bone}'
            z_values = []
            
            for frame in data:
                if 'input' in frame and bone_name in frame['input']:
                    z = frame['input'][bone_name].get('z')
                    if z is not None:
                        z_values.append(z)
            
            if z_values:
                key = f'{hand}_{finger}_{bone}'
                z_values_by_finger[key] = {
                    'min': min(z_values),
                    'max': max(z_values),
                    'range': max(z_values) - min(z_values)
                }

print('\nZ軸の値の範囲（指ごと）:')
for key, stats in sorted(z_values_by_finger.items()):
    hand, finger, bone = key.split('_')
    print(f'{hand:5s} {finger:7s} {bone:12s}: '
          f'{stats["min"]:7.3f} ~ {stats["max"]:7.3f} '
          f'({math.degrees(stats["min"]):6.1f}° ~ {math.degrees(stats["max"]):6.1f}°)')

# X軸の値の統計（手のひらの向き）
print('\n' + '=' * 70)
print('X軸の値の範囲（spread: 負 = 内側？、正 = 外側？）')
print('=' * 70)

x_values_by_finger = {}
for hand in ['right', 'left']:
    for finger in ['Thumb', 'Index', 'Middle', 'Ring', 'Little']:
        for bone in ['Proximal']:
            bone_name = f'{hand}{finger}{bone}'
            x_values = []
            
            for frame in data:
                if 'input' in frame and bone_name in frame['input']:
                    x = frame['input'][bone_name].get('x')
                    if x is not None:
                        x_values.append(x)
            
            if x_values:
                key = f'{hand}_{finger}'
                x_values_by_finger[key] = {
                    'min': min(x_values),
                    'max': max(x_values),
                    'avg': sum(x_values) / len(x_values)
                }

print('\nX軸の値（Proximal骨のみ）:')
for key, stats in sorted(x_values_by_finger.items()):
    hand, finger = key.split('_')
    print(f'{hand:5s} {finger:7s}: '
          f'平均={stats["avg"]:7.3f} ({math.degrees(stats["avg"]):6.1f}°), '
          f'範囲={stats["min"]:7.3f} ~ {stats["max"]:7.3f}')

# 診断
print('\n' + '=' * 70)
print('診断')
print('=' * 70)

# Z軸が全て負ならば、指が常に曲がっていることになる
all_z_negative = all(stats['max'] < 0 for stats in z_values_by_finger.values())
all_z_positive = all(stats['min'] > 0 for stats in z_values_by_finger.values())

if all_z_negative:
    print('\n⚠️ 問題: すべての指のZ軸が負')
    print('   → 指を立てても曲がって見える')
    print('   解決策: bendAngleの計算式を反転')
elif all_z_positive:
    print('\n⚠️ 問題: すべての指のZ軸が正')
    print('   → 指を曲げても伸びて見える')
    print('   解決策: bendAngleの計算式を反転')
else:
    print('\n✅ Z軸は正負両方の値がある（正常な範囲）')

# X軸の確認
print('\nX軸（spread）の確認:')
right_fingers = {k: v for k, v in x_values_by_finger.items() if k.startswith('right')}
left_fingers = {k: v for k, v in x_values_by_finger.items() if k.startswith('left')}

if right_fingers:
    right_avg = sum(v['avg'] for v in right_fingers.values()) / len(right_fingers)
    print(f'  右手の平均X軸: {right_avg:.3f} ({math.degrees(right_avg):.1f}°)')

if left_fingers:
    left_avg = sum(v['avg'] for v in left_fingers.values()) / len(left_fingers)
    print(f'  左手の平均X軸: {left_avg:.3f} ({math.degrees(left_avg):.1f}°)')

if right_fingers and left_fingers:
    if right_avg * left_avg > 0:  # 同じ符号
        print('\n⚠️ 問題: 右手と左手のX軸が同じ符号')
        print('   → 手のひらが両方とも同じ方向を向いている')
        print('   解決策: 左右どちらかの符号を反転')
