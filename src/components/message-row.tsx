import { Tag } from "@/components/ui/tag";
import { FOCUS } from "@/components/ui/page";
import { type MessageTarget, type UserNotification } from "@/lib/messages";
import { presentNotification } from "@/lib/notification-copy";

/** One link per message; opening marks it read. Stored copy is unchanged. */
export function MessageRow({
  message,
  time,
  target,
}: {
  message: UserNotification;
  time: string;
  target: MessageTarget | null;
}) {
  const unread = !message.read_at;
  const { title, body: text } = presentNotification(message);
  const body = (
    <>
      <span className="grid min-w-0 gap-1">
        <span className={`text-body [overflow-wrap:anywhere] ${unread ? "font-semibold" : ""}`}>
          {title}
        </span>
        <span className="text-small text-ink-dim [overflow-wrap:anywhere]">{text}</span>
      </span>
      <span className="grid justify-items-end gap-1 text-small text-ink-faint tabular-nums">
        <time dateTime={message.created_at}>{time}</time>
        {unread ? <Tag tone="you">New</Tag> : target ? <span aria-hidden="true">›</span> : null}
      </span>
    </>
  );
  const box = "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md py-3";
  if (!target && !unread) {
    return <div className={box}>{body}</div>;
  }
  return (
    // A plain <a>, not <Link>: opening marks the message read, so it must never be prefetched.
    <a className={`${box} ${FOCUS} hover:bg-panel/60`} href={`/messages/${message.id}/open`}>
      {body}
    </a>
  );
}
