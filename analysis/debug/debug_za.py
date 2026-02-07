import json

with open('log/motion-debug-log-1768638264230.json', 'r') as f:
    data = json.load(f)

# 中間フレーム（腕を上げている時）のデータを確認
mid_frame = data[len(data)//2]

print('=== 中間フレームのworldLandmarks ===')
print(f'右肩(12): x={mid_frame["worldLandmarks"][12]["x"]:.4f}, y={mid_frame["worldLandmarks"][12]["y"]:.4f}, z={mid_frame["worldLandmarks"][12]["z"]:.4f}')
print(f'右肘(14): x={mid_frame["worldLandmarks"][14]["x"]:.4f}, y={mid_frame["worldLandmarks"][14]["y"]:.4f}, z={mid_frame["worldLandmarks"][14]["z"]:.4f}')
print(f'右手首(16): x={mid_frame["worldLandmarks"][16]["x"]:.4f}, y={mid_frame["worldLandmarks"][16]["y"]:.4f}, z={mid_frame["worldLandmarks"][16]["z"]:.4f}')
print()
print(f'左肩(11): x={mid_frame["worldLandmarks"][11]["x"]:.4f}, y={mid_frame["worldLandmarks"][11]["y"]:.4f}, z={mid_frame["worldLandmarks"][11]["z"]:.4f}')
print(f'左肘(13): x={mid_frame["worldLandmarks"][13]["x"]:.4f}, y={mid_frame["worldLandmarks"][13]["y"]:.4f}, z={mid_frame["worldLandmarks"][13]["z"]:.4f}')
print(f'左手首(15): x={mid_frame["worldLandmarks"][15]["x"]:.4f}, y={mid_frame["worldLandmarks"][15]["y"]:.4f}, z={mid_frame["worldLandmarks"][15]["z"]:.4f}')
print()
print('=== VRM出力（riggedPose input） ===')
print(f'RightUpperArm.z: {mid_frame["input"]["RightUpperArm"]["z"]:.4f} rad')
print(f'LeftUpperArm.z: {mid_frame["input"]["LeftUpperArm"]["z"]:.4f} rad')

# 最初と最後のフレームも確認
print('\n=== 最初のフレーム ===')
first = data[0]
print(f'右手首Y: {first["worldLandmarks"][16]["y"]:.4f}')
print(f'左手首Y: {first["worldLandmarks"][15]["y"]:.4f}')
print(f'RightUpperArm.z: {first["input"]["RightUpperArm"]["z"]:.4f} rad')

print('\n=== 最後のフレーム ===')
last = data[-1]
print(f'右手首Y: {last["worldLandmarks"][16]["y"]:.4f}')
print(f'左手首Y: {last["worldLandmarks"][15]["y"]:.4f}')
print(f'RightUpperArm.z: {last["input"]["RightUpperArm"]["z"]:.4f} rad')
