# Equirectangular Storyboard Web Spec

## 目的

2D 絵コンテ画像を Equirectangular 空間に配置し、編集結果を Web 上で確認する。

## 対象

- Equirectangular ガイド画像 1 枚
- Equirectangular 背景画像 1 枚
- 2D 画像 10 枚まで
- Web 上の VR プレビュー

## 入力

### 1. ガイド画像

- `equirectangular_guide_2x1.png`
- 2:1 の 8K Equirectangular
- 編集対象ではなく、表示補助として固定表示する

### 2. 背景画像

- Equirectangular 背景画像を 1 枚読み込める
- 背景は任意
- 読み込み後はシーンの基準背景として使う

### 3. 2D レイヤー

- 最大 10 枚
- 通常の画像ファイルを使う
- 各レイヤーは Equirectangular 上で投影表示される

## 配置操作

### 基本操作

- マウスドラッグで配置位置を調整できる
- 緯度経度で数値入力できる
- カメラからの距離を数値入力できる

### 画像ごとの操作項目

- 緯度
- 経度
- 距離
- 回転
- スケール
- 表示/非表示

### 意図

- 画像は常にカメラの方を向く
- 回転は 2D 的な傾き調整として扱う
- 奥行きはカメラからの距離で管理する

## 天球ドーム

- 天球ドームの大きさを設定できる
- 既定値は `STmap_and_Projection_Project/Projection_Previewer.nk` から持ってくる
- 既定の参照値:
  - Sphere radius: `527`
  - Sphere scaling: `{1 0.85 1}`
  - Geometry translate: `{0 0 -129.92}`

## カメラ

- カメラ位置は移動できる
- 既定位置は `(0, 0, 0)`
- 回転は HMD の回転を使う
- HMD がない場合はエディタのプレビュー回転を代替入力として使う

## VR プレビュー

- Web UI 内の Three.js プレビューとして実装する
- 編集画面と同じシーン定義を使う
- VR 表示は HMD 向けの立体プレビューを想定する
- まずは「見える」ことを優先し、編集操作と VR 実行を分離する

## シーンデータ

最低限の保持項目:

- background image
- guide image
- layer list
- each layer's position, rotation, scale, distance
- dome size
- camera position

## MVP の完了条件

1. 背景画像を 1 枚読み込める
2. ガイド画像を 1 枚重ねられる
3. 2D 画像を 10 枚まで配置できる
4. ドラッグと数値入力の両方で調整できる
5. ドームサイズを変更できる
6. カメラ位置を動かせる
7. Three.js の VR プレビューで結果を確認できる

