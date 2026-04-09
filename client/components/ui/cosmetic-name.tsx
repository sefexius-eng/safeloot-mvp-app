import CensoredText from "@/components/censored-text";
import {
  getNicknameAppearanceClassName,
  getNicknameAppearanceStyle,
  type UserAppearanceData,
} from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

interface CosmeticNameProps {
  text: string;
  appearance?: Partial<UserAppearanceData> | null;
  className?: string;
}

export function CosmeticName({
  text,
  appearance,
  className,
}: CosmeticNameProps) {
  return (
    <CensoredText
      text={text}
      className={cn(className, getNicknameAppearanceClassName(appearance))}
      style={getNicknameAppearanceStyle(appearance)}
    />
  );
}