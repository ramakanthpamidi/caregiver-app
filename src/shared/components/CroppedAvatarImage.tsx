import React from 'react';
import { View, Image } from 'react-native';
import type { ProfileAvatar } from '../../features/profiles/lib/profileAvatar';

type Props = {
  avatar: ProfileAvatar;
  size: number;
};

// The avatar editor stores transforms relative to a 240px crop circle.
const AVATAR_EDITOR_CIRCLE_SIZE = 240;

export default function CroppedAvatarImage({ avatar, size }: Props) {
  const ratio = size / AVATAR_EDITOR_CIRCLE_SIZE;
  const imgW = (avatar.imgW || AVATAR_EDITOR_CIRCLE_SIZE) * ratio;
  const imgH = (avatar.imgH || AVATAR_EDITOR_CIRCLE_SIZE) * ratio;
  const tx = (avatar.tx || 0) * ratio;
  const ty = (avatar.ty || 0) * ratio;
  const storedScale = avatar.scale || 1;

  // Older saved avatars used a "contain"-style base scale (circle / max(w,h)), which can
  // produce empty edges (background ring) for wide/tall photos.
  // Enforce a minimum scale so the image always fully covers the crop circle.
  const rawImgW = avatar.imgW || AVATAR_EDITOR_CIRCLE_SIZE;
  const rawImgH = avatar.imgH || AVATAR_EDITOR_CIRCLE_SIZE;
  const requiredScale = Math.max(
    rawImgW > 0 ? AVATAR_EDITOR_CIRCLE_SIZE / rawImgW : 1,
    rawImgH > 0 ? AVATAR_EDITOR_CIRCLE_SIZE / rawImgH : 1
  );
  const scale = Math.max(storedScale, requiredScale);

  // IMPORTANT: apply zoom by increasing the rendered Image size instead of using
  // a scale transform. Otherwise Android may decode the bitmap at the unscaled size
  // and then upscale it on screen, which looks blurry.
  const renderW = imgW * scale;
  const renderH = imgH * scale;

  // Use a circular clipping container so the avatar always appears as a circle
  // even if the source image has rectangular content.
  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <View style={{ transform: [{ translateX: tx }, { translateY: ty }] }}>
        <Image
          source={{ uri: avatar.uri }}
          style={{ width: renderW, height: renderH, backgroundColor: 'transparent' }}
          resizeMode="cover"
          resizeMethod="resize"
        />
      </View>
    </View>
  );
}
