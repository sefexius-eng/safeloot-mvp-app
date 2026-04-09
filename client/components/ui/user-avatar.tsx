import Image from "next/image";

import {
  getAvatarDecorationClassName,
  getAvatarDecorationImageSrc,
} from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  alt?: string;
  decoration?: string | null;
  className?: string;
  imageClassName?: string;
}

export function UserAvatar({
  alt,
  className,
  decoration,
  email,
  imageClassName,
  name,
  src,
}: UserAvatarProps) {
  const label = name?.trim() || email?.trim() || "Пользователь";
  const decorationClassName = getAvatarDecorationClassName(decoration);
  const decorationImageSrc = getAvatarDecorationImageSrc(decoration);

  return (
    <div
      role="img"
      aria-label={alt ?? `Аватар ${label}`}
      className={cn(
        "relative flex items-center justify-center overflow-visible rounded-full border border-white/10 bg-zinc-800/80 text-zinc-400",
        className,
      )}
    >
      {decorationClassName ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-[-4px] rounded-[inherit]",
            decorationClassName,
          )}
        />
      ) : null}
      {decorationImageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={decorationImageSrc}
          alt="Frame"
          aria-hidden="true"
          className="pointer-events-none absolute -left-[12%] -top-[12%] z-10 h-[124%] w-[124%] max-w-none object-contain"
        />
      ) : null}
      <span className="relative z-[1] flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            unoptimized
            sizes="128px"
            className={cn("h-full w-full object-cover", imageClassName)}
          />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-[58%] w-[58%]"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 20a6 6 0 0 0-12 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        )}
      </span>
    </div>
  );
}