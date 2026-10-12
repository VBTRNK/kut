import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { FOCUS } from "./page";

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: ReactNode;
  /** A Small line under the input, read out with it (`aria-describedby`). */
  help?: ReactNode;
};

/** `Field`: a label (Small 600), the input, and a Small help line. */
export function Field({ label, help, id, type = "text", ...input }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const helpId = `${inputId}-help`;
  return (
    <div className="grid gap-2">
      <label className="text-small font-semibold" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={help ? helpId : undefined}
        className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-board-deep/60 px-4 text-body text-ink placeholder:text-ink-faint focus:border-brass-line focus:outline-none"
        id={inputId}
        type={type}
        {...input}
      />
      {help && (
        <p className="text-small text-ink-dim" id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "role"> & {
  on: boolean;
  /** The switch's accessible name. */
  label: string;
};

/**
 * `Switch`: the one toggle, a `role="switch"` button. Its state is also a word
 * beside it at the call site (a `Tag`), so the colour is never the only signal.
 */
export function Switch({ on, label, type = "button", ...rest }: SwitchProps) {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      className={`relative inline-block h-8 w-[52px] flex-none rounded-full disabled:opacity-50 ${on ? "bg-moss" : "bg-line"} ${FOCUS}`}
      role="switch"
      type={type}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-6 w-6 rounded-full transition-[left] motion-reduce:transition-none ${on ? "left-6 bg-board-deep" : "left-1 bg-ink-dim"}`}
      />
    </button>
  );
}
