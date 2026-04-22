export type Vec3 = [number, number, number];

export type StoryboardLayer = {
  id: string;
  name: string;
  imageUrl: string;
  imageName?: string;
  imageAspect?: number;
  latitude: number;
  longitude: number;
  distance: number;
  rotation: number;
  scale: number;
  visible: boolean;
};

export type StoryboardScene = {
  guideImageUrl: string;
  backgroundImageUrl: string;
  dome: {
    radius: number;
    scale: Vec3;
    translate: Vec3;
  };
  camera: {
    position: Vec3;
  };
  layers: StoryboardLayer[];
};
