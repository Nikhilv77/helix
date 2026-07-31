import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface BaseButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

type ButtonProps =
  | (BaseButtonProps & { href: string })
  | (BaseButtonProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>);

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-white bg-white text-slate-950 shadow-[0_18px_44px_rgba(255,255,255,0.10)] hover:border-white hover:bg-slate-100",
  secondary: "border-white/12 bg-white/[0.06] text-ink hover:border-white/24 hover:bg-white/[0.1]",
  danger:
    "border-red-400/30 bg-red-500/14 text-red-200 hover:border-red-300/50 hover:bg-red-500/20",
  ghost: "border-transparent bg-transparent text-muted hover:bg-white/8 hover:text-ink"
};

export function Button({
  children,
  icon,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45",
    variantClasses[variant],
    className
  ].join(" ");

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button className={classes} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
