# Equirectangular Viewer Spec

## 目的

読み込んだ Equirectangular 画像や動画を、Web 上と VR でそのまま閲覧する。

## 対象

- Equirectangular 画像 1 枚
- Equirectangular 動画 1 本
- Web 上の VR プレビュー
- Editor とは別アプリとして提供する

## 位置づけ

- このアプリは閲覧専用とする
- 2D レイヤーの配置、回転、距離調整などの編集機能は持たない
- Editor と同じシーン表現を共通化して、読み込みと描画ロジックは再利用する

## 入力

### 1. Equirectangular 画像

- 2:1 の Equirectangular 画像を 1 枚読み込める
- 背景として全面表示する
- ガイドは必須ではない

### 2. Equirectangular 動画

- Equirectangular 動画を 1 本読み込める
- 再生、停止、シークができる
- 動画は VR プレビューでも同じ内容を表示する

## 表示

### 基本表示

- Web 画面で Equirectangular をそのまま閲覧できる
- 画像と動画は切り替えて表示できる
- 表示倍率やフィット方式は固定せず、画面に収まることを優先する

### VR プレビュー

- Three.js ベースで VR 表示する
- HMD 向けに Equirectangular を球面へ投影して表示する
- VR では閲覧に集中し、編集操作はしない

## 操作

### 画像

- ファイル読み込み
- 画面内での拡大縮小
- 表示リセット

### 動画

- 再生
- 一時停止
- シーク
- リピート再生

### VR

- VR プレビュー開始
- HMD の回転で視点移動
- マウスドラッグでの簡易プレビュー回転

## シーンデータ

最低限の保持項目:

- source type (`image` or `video`)
- source url or file reference
- playback state
- view transform
- last opened source

## 共有可能な共通化対象

- Equirectangular 投影の座標変換
- Three.js の球体描画
- VR 起動処理
- 画像/動画の読み込みユーティリティ
- ファイル保存/最近使ったファイル管理の共通基盤

## MVP の完了条件

1. Equirectangular 画像を 1 枚読み込める
2. Equirectangular 動画を 1 本読み込める
3. Web 上で Equirectangular を見られる
4. VR プレビューで同じ内容を見られる
5. 再生、停止、シークができる
6. Editor とは別アプリとして起動できる

## 備考

- まずは閲覧専用を優先し、編集やアノテーションは後回しにする
- Editor との共通化は、UI ではなく読み込み・描画・VR 基盤から進める
