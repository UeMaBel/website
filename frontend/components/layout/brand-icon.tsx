import Image from "next/image";

export function BrandIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <Image src="/icon.svg" width={size} height={size} alt="" className={className} />;
}
