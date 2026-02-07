#!/usr/bin/env python3
import json
import math

# 新しいログファイル名を取得
import os
log_files = [f for f in os.listdir('log') if f.startswith('motion-debug-log-') and f.endswith('.json')]
log_files.sort(reverse=True)
latest_log = f'log/{log_files[0]}'

print(f'最新ログファイル: {latest_log}')

with open(latest_log, 'r') as f:
    data = json.load(f)

print('=' * 70)
print('左手親指の角度分析')
print('=' * 70)
print(f'総フレーム数: {len(data)}\n')

# 左手親指の値を時系列で追跡
thumb_data = []
for i, frame in enumerate(data):
    if 'input' not in frame:
        continue
    
    thumb_frame = {'frame': i}
    for bone in ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal']:
        if bone in frame['input']:
            rot = frame['input'][bone]
            thumb_frame[bone] = {
                'x': rot.get('x', 0),
                'y': rot.get('y', 0),
                'z': rot.get('z', 0)
            }
    
    if len(thumb_frame) > 1:  # 親指データがある
        thumb_data.append(thumb_frame)

print(f'親指データがあるフレーム: {len(thumb_data)}個\n')

# 最初の10フレームを表示
print('最初の10フレームの親指の角度:')
print('=' * 70)
for data_point in thumb_data[:10]:
    print(f"\nFrame {data_point['frame']}:")
    for bone in ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal']:
        if bone in data_point:
            rot = data_point[bone]
            print(f"  {bone:23s}: X={rot['x']:7.3f} ({math.degrees(rot['x']):6.1f}°), "
                  f"Z={rot['z']:7.3f} ({math.degrees(rot['z']):6.1f}°)")

# 統計
print('\n' + '=' * 70)
print('左手親指の角度範囲')
print('=' * 70)

for bone in ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal']:
    x_values = [d[bone]['x'] for d in thumb_data if bone in d]
    z_values = [d[bone]['z'] for d in thumb_data if bone in d]
    
    if x_values and z_values:
        print(f'\n{bone}:')
        print(f'  X軸: {min(x_values):7.3f} ~ {max(x_values):7.3f} '
              f'({math.degrees(min(x_values)):6.1f}° ~ {math.degrees(max(x_values)):6.1f}°)')
        print(f'  Z軸: {min(z_values):7.3f} ~ {max(z_values):7.3f} '
              f'({math.degrees(min(z_values)):6.1f}° ~ {math.degrees(max(z_values)):6.1f}°)')

# 他の指と比較
print('\n' + '=' * 70)
print('左手の全指の比較（Proximalのみ）')
print('=' * 70)

finger_stats = {}
for finger in ['Thumb', 'Index', 'Middle', 'Ring', 'Little']:
    bone = f'left{finger}Proximal'
    x_values = []
    z_values = []
    
    for frame in data:
        if 'input' in frame and bone in frame['input']:
            rot = frame['input'][bone]
            x_values.append(rot.get('x', 0))
            z_values.append(rot.get('z', 0))
    
    if x_values and z_values:
        finger_stats[finger] = {
            'x_min': min(x_values),
            'x_max': max(x_values),
            'x_avg': sum(x_values) / len(x_values),
            'z_min': min(z_values),
            'z_max': max(z_values),
            'z_avg': sum(z_values) / len(z_values)
        }

for finger, stats in finger_stats.items():
    print(f'\n{finger}:')
    print(f'  X軸: 平均={stats["x_avg"]:7.3f} ({math.degrees(stats["x_avg"]):6.1f}°), '
          f'範囲={stats["x_min"]:7.3f} ~ {stats["x_max"]:7.3f}')
    print(f'  Z軸: 平均={stats["z_avg"]:7.3f} ({math.degrees(stats["z_avg"]):6.1f}°), '
          f'範囲={stats["z_min"]:7.3f} ~ {stats["z_max"]:7.3f}')

# 診断
print('\n' + '=' * 70)
print('診断')
print('=' * 70)

if 'Thumb' in finger_stats:
    thumb = finger_stats['Thumb']
    
    # 親指のX軸が他の指と大きく異なるか確認
    other_fingers_x = [stats['x_avg'] for name, stats in finger_stats.items() if name != 'Thumb']
    avg_other_x = sum(other_fingers_x) / len(other_fingers_x) if other_fingers_x else 0
    
    print(f'\n親指のX軸平均: {thumb["x_avg"]:.3f} ({math.degrees(thumb["x_avg"]):.1f}°)')
    print(f'他の指のX軸平均: {avg_other_x:.3f} ({math.degrees(avg_other_x):.1f}°)')
    print(f'差: {abs(thumb["x_avg"] - avg_other_x):.3f} ({math.degrees(abs(thumb["x_avg"] - avg_other_x)):.1f}°)')
    
    if abs(thumb["x_avg"] - avg_other_x) < 0.5:  # 約30度以下
        print('\n⚠️ 問題: 親指のX軸が他の指と近すぎる')
        print('   親指は手のひらから垂直方向に伸びるため、X軸の扱いが特別であるべき')
    
    # Z軸が閉じた状態で負になっているか確認
    if thumb['z_min'] < 0:
        print('\n✅ Z軸は負の値を含む（指を閉じると負になる）')
    else:
        print('\n⚠️ Z軸が常に正（指を閉じても正のまま）')
    
    # 親指が閉じた状態での違和感の原因を推測
    print('\n可能性のある問題:')
    print('1. 親指の座標系が他の指と異なるため、同じ計算式では不適切')
    print('2. 親指のspreadAngle (X軸) が手のひらの向きを考慮していない')
    print('3. 親指のbendAngle (Z軸) の基準が手のひら平面ではなく前腕軸になっている')
