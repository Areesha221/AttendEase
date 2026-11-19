type AvatarProps = {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
};

/** Profile photo with an initials fallback. */
export default function Avatar({ src, name, size = 48, className = "" }: AvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photos are inline data URIs
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-950 ring-2 ring-white ${className}`}
    >
      {initials}
    </span>
  );
}
