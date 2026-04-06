import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
}

export function UserAvatar({
  alt,
  className,
  email,
  imageClassName,
  name,
  src,
}: UserAvatarProps) {
  const label = name?.trim() || email?.trim() || "Пользователь";

  return (
    <div
      role="img"
      aria-label={alt ?? `Аватар ${label}`}
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800/80 text-zinc-400",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
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
    </div>
  );
}