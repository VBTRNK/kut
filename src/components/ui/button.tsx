import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FOCUS } from "./page";

const BUTTON = {
  /** The one primary action on a screen. */
  primary: "bg-brass font-extrabold text-ink-on-accent hover:brightness-105",
  secondary: "border border-line bg-panel font-semibold text-ink hover:border-brass-line",
} as const;

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  /** A link that looks like a button; the button attributes are then unused. */
  href?: string;
  kind?: keyof typeof BUTTON;
  wide?: boolean;
  children: ReactNode;
};

/**
 * `Button`: one filled brass button per screen; everything else is secondary,
 * a tile or a link. Without `href` it is a real `<button>` (`type="button"`
 * unless given) that takes a form's attributes.
 */
export function Button({ href, kind = "primary", wide = false, children, ...rest }: ButtonProps) {
  const className = `inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-body disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[kind]} ${wide ? "w-full" : ""} ${FOCUS}`;
  if (href !== undefined) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...rest} className={className}>
      {children}
    </button>
  );
}
