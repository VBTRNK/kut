import { PAGE, COLUMN, PageHeader } from "@/components/ui/page";
import { MessageRow } from "@/components/message-row";
import { requireUser } from "@/lib/auth/user";
import { groupMessages, messageTarget, type UserNotification } from "@/lib/messages";
import { loadTargetLookups, MESSAGE_COLUMNS } from "@/lib/messages-load";
import { createClient } from "@/lib/supabase/server";
import { MarkAllMessagesReadForm } from "./message-read-forms";

/**
 * The inbox (design/ux-review `Messages`, ADR-114): compact rows grouped by
 * day, each one link to what it is about; opening one marks it read, and
 * "Mark all read" stays.
 */
export default async function MessagesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("user_notifications")
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Could not load your messages.");
  const messages = (data ?? []) as UserNotification[];
  const unreadCount = messages.filter((message) => !message.read_at).length;
  const lookups = await loadTargetLookups(supabase, messages);
  const groups = groupMessages(messages, new Date());

  return (
    <main className={PAGE}>
      <section className={COLUMN}>
        <PageHeader title="Messages" />

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-10 text-center">
            <h2 className="font-semibold text-heading">Your inbox is clear</h2>
            <p className="mt-3 text-ink-dim">Club and market updates will appear here.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-small text-ink-dim">{unreadCount} new</p>
              {unreadCount > 0 && <MarkAllMessagesReadForm />}
            </div>
            <div className="grid gap-1">
              {groups.map((group) => (
                <section aria-label={group.heading} className="grid gap-1" key={group.heading}>
                  <h2 className="px-0 pt-3.5 pb-1.5 text-label font-semibold text-ink-faint">
                    {group.heading}
                  </h2>
                  <ol className="grid rounded-2xl border border-line/60 bg-panel/60 px-4 [&>li]:border-b [&>li]:border-line/40 [&>li:last-child]:border-b-0">
                    {group.messages.map(({ message, time }) => (
                      <li key={message.id}>
                        <MessageRow
                          message={message}
                          target={messageTarget(message, lookups)}
                          time={time}
                        />
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
