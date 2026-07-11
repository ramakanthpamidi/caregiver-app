import { Text, TextInput } from 'react-native';

import { Typography } from './theme';

let installed = false;

function mergeStyle(base: any, next: any) {
  if (!base) return next;
  if (Array.isArray(base)) return [...base, next];
  return [base, next];
}

export function installGlobalTypography(): void {
  if (installed) return;
  installed = true;

  const baseTextStyle = { fontFamily: Typography.fontFamily.regular };
  const baseInputStyle = { fontFamily: Typography.fontFamily.regular };
  const TextComponent = Text as typeof Text & { defaultProps?: Record<string, any> };
  const TextInputComponent = TextInput as typeof TextInput & { defaultProps?: Record<string, any> };

  TextComponent.defaultProps = TextComponent.defaultProps || {};
  TextComponent.defaultProps.style = mergeStyle(TextComponent.defaultProps.style, baseTextStyle);

  TextInputComponent.defaultProps = TextInputComponent.defaultProps || {};
  TextInputComponent.defaultProps.style = mergeStyle(TextInputComponent.defaultProps.style, baseInputStyle);
}
