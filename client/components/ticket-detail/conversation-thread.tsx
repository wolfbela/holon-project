'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Headset } from 'lucide-react';
import type { Reply } from '@shared/types/reply';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ConversationThreadProps {
  replies: Reply[];
  ticketAuthorName: string;
  isLoading: boolean;
  viewerRole: 'customer' | 'agent';
}

export function ConversationThread({
  replies,
  ticketAuthorName,
  isLoading,
  viewerRole,
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isLoading) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [replies.length, isLoading]);

  return (
    <div className="mt-8">
      <Separator className="mb-6" />
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Conversation
      </p>

      {!isLoading && replies.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-8 text-center">
          <MessageSquare className="size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No replies yet. Send a message to get the conversation started.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1"
          aria-live="polite"
          aria-label="Conversation messages"
        >
          {replies.map((reply, index) => {
            const isSelf =
              viewerRole === 'customer'
                ? reply.author_type === 'customer'
                : reply.author_type === 'agent';
            const displayName = isSelf
              ? 'You'
              : reply.author_type === 'customer'
                ? ticketAuthorName
                : 'Support Agent';

            return (
              <motion.div
                key={reply.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.05, 0.5),
                  ease: 'easeOut',
                }}
                className={cn('flex gap-2.5', isSelf ? 'justify-end' : 'justify-start')}
              >
                {!isSelf && (
                  <Avatar className="mt-5 shrink-0">
                    <AvatarFallback>
                      {reply.author_type === 'agent' ? (
                        <Headset className="size-3.5" />
                      ) : (
                        getInitials(ticketAuthorName)
                      )}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    'max-w-[80%] space-y-1',
                    isSelf ? 'items-end' : 'items-start',
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-medium text-muted-foreground',
                      isSelf && 'text-right',
                    )}
                  >
                    {displayName}
                  </p>

                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isSelf
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md bg-muted text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {reply.message}
                    </p>
                  </div>

                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground',
                      isSelf && 'text-right',
                    )}
                  >
                    {formatRelativeTime(reply.created_at)}
                  </p>
                </div>

                {isSelf && (
                  <Avatar className="mt-5 shrink-0">
                    <AvatarFallback>
                      {viewerRole === 'customer' ? (
                        getInitials(ticketAuthorName)
                      ) : (
                        <Headset className="size-3.5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
