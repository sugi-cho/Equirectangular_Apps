import type { StoryboardScene } from "./types";

export const defaultScene: StoryboardScene = {
  guideImageUrl: "/equirectangular_guide_2x1.png",
  backgroundImageUrl: "",
  dome: {
    radius: 527,
    scale: [1, 0.85, 1],
    translate: [0, 0, -129.92],
  },
  camera: {
    position: [0, 0, 0],
  },
  layers: [
    {
      id: "layer-1",
      name: "Shot A",
      imageUrl: "",
      latitude: 0,
      longitude: 0,
      distance: 6,
      rotation: 0,
      scale: 1,
      visible: true,
    },
  ],
};
