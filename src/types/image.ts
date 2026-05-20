export interface MovieCover {
  id: number;
  code: string;
  image_path: string;
  is_primary: boolean;
  source: string;
}

export interface MovieScreenshot {
  id: number;
  code: string;
  image_path: string;
  sort_order: number;
}

export interface ActorImage {
  id: number;
  actor_id: number;
  image_path: string;
  sort_order: number;
}
