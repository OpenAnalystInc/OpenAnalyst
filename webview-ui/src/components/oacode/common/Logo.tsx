import React from "react";

type Props = {
  width?: number;
  height?: number;
  className?: string;
} & React.SVGProps<SVGSVGElement>;

export default function SvgConverted({ width = 100, height = 100, className, ...rest }: Props) {
  return (
    <svg 
      width={width} 
      height={height} 
      className={className}
      viewBox="0 0 512 512" 
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <rect width="512" height="512" rx="64" ry="64" fill="#0F1320"/>
      <circle cx="256" cy="256" r="164" fill="none" stroke="#FFFFFF" strokeWidth="28"/>
      <path d="M160 380 L256 140 L352 380" fill="none" stroke="#FFFFFF" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="208" y1="300" x2="304" y2="300" stroke="#FFFFFF" strokeWidth="22" strokeLinecap="round"/>
      <g stroke="#FFFFFF" strokeWidth="20" strokeLinecap="round">
        <line x1="122" y1="118" x2="170" y2="118"/><line x1="122" y1="118" x2="122" y2="166"/>
        <line x1="390" y1="118" x2="342" y2="118"/><line x1="390" y1="118" x2="390" y2="166"/>
        <line x1="122" y1="394" x2="170" y2="394"/><line x1="122" y1="394" x2="122" y2="346"/>
        <line x1="390" y1="394" x2="342" y2="394"/><line x1="390" y1="394" x2="390" y2="346"/>
      </g>
    </svg>
  );
}
