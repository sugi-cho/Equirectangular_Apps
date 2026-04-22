# Equirectangular Viewer

Equirectangular 画像と動画を閲覧する Web アプリです。

## 起動

```powershell
npm install
npm run dev
```

## 目的

- 画像や動画をそのまま閲覧する
- Three.js で VR プレビューを出す
- Editor と共通の描画基盤を将来分離して使う
- `public/stmap/current/` に置いた STMap 変換データを重ねる

## STMap 更新

```powershell
npm run stmap:build -- --input <Your_STMap.exr>
```

生成物は `public/stmap/current/` の固定ファイルを差し替えます。
