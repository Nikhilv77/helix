import Image, { type ImageProps } from "next/image";

/**
 * The shared in-product Trailgrad mark. Product surfaces are dark, so the
 * transparent white artwork stays crisp without adding a tile of its own.
 */
export function TrailgradMark({
  className,
  ...props
}: Omit<ImageProps, "src" | "alt" | "width" | "height">) {
  return (
    <Image
      src="/brand/logo-transparent.png"
      alt=""
      width={500}
      height={500}
      aria-hidden="true"
      className={["object-contain", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
