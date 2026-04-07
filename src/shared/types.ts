export type ModelType = 'gemini-3-pro-image-preview' | 'gemini-3.1-flash-image-preview';

export interface AnalysisResult {
  photo_type: string;
  subject_count: number;
  face_sizes: string;
  is_black_white: boolean;
  is_sepia: boolean;
  damage_types: string[];
  damage_severity: string;
  clothing_visible: boolean;
  clothing_detail_needed: boolean;
  background_complexity: string;
  background_importance: string;
  era_estimate: string;
  requires_group_restore: boolean;
  recommended_model: string;
  special_challenges: string | null;
}

export interface PipelineStatus {
  step: string;
  progress: number;
}

export interface RestoreOptions {
  model: ModelType;
  colorize: boolean;
  replaceClothing: boolean;
  clothingPrompt: string;
}

export type IdPhotoAspectRatio = '3:4' | '4:3' | '4:6' | '6:4' | '2:3' | '3:2' | '1:1';
export type IdPhotoBackgroundMode = 'white' | 'blue' | 'gray' | 'custom';
export type IdPhotoGaze = 'keep' | 'look_straight' | 'slight_frontal_adjust';
export type IdPhotoExpression = 'keep' | 'neutral' | 'soft_smile' | 'serious';
export type IdPhotoPose =
  | 'keep'
  | 'standard_id'
  | 'straighten_head'
  | 'level_shoulders'
  | 'neutral_formal_angle_15'
  | 'neutral_three_quarter_soft'
  | 'male_formal_angle_15'
  | 'male_three_quarter_soft'
  | 'female_formal_angle_15'
  | 'female_three_quarter_soft'
  | 'female_soft_shoulder_angle';
export type IdPhotoCrop = 'auto_id' | 'head_shoulders' | 'half_body';

export interface IdPhotoOptions {
  model: ModelType;
  aspectRatio: IdPhotoAspectRatio;
  cropStyle: IdPhotoCrop;
  backgroundMode: IdPhotoBackgroundMode;
  backgroundCustomPrompt: string | null;
  replaceClothing: boolean;
  clothingPrompt: string | null;
  gazeDirection: IdPhotoGaze;
  expressionPreset: IdPhotoExpression;
  poseCorrection: IdPhotoPose;
  additionalInstructions: string | null;
}

export interface UserSettingsStatusResponse {
  hasApiKey: boolean;
  userId: string;
}
