import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useVSCodeTheme } from "@/oacode/hooks/useVSCodeTheme";

type Props = {
  width?: number;
  height?: number;
  className?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>;

export default function Logo({
  width = 100,
  height = 120,
  className,
  ...rest
}: Props) {
  const [imagesBaseUri] = useState(() => {
    const w = window as any;
    return w.IMAGES_BASE_URI || "";
  });

  const theme = useVSCodeTheme();
  const isLightTheme = theme === "vscode-light" || theme === "vscode-high-contrast-light";
  const logoFile = isLightTheme ? "oa-light.svg" : "oa-dark.svg";

  return (
    <img 
      src={`${imagesBaseUri}/${logoFile}`} 
      alt="OpenAnalyst" 
      width={width} 
      height={height}
      className={cn("my-6", className)}
      {...rest}
    />
  );
}
