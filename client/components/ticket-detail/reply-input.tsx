'use client';

import { useState, useCallback, useMemo } from 'react';
import { SendHorizontal, Loader2, Lock } from 'lucide-react';
import type { Reply } from '@shared/types/reply';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 5000;

interface ReplyInputProps {
  onSubmit: (message: string) => Promise<Reply | undefined>;
  isSubmitting: boolean;
  isDisabled: boolean;
}

export function ReplyInput({
  onSubmit,
  isSubmitting,
  isDisabled,
}: ReplyInputProps) {
  const [message, setMessage] = useState('');

  const isMac = useMemo(
    () =>
      typeof window !== 'undefined' &&
      /Mac|iPhone|iPad/.test(window.navigator.userAgent),
    [],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isSubmitting) return;

    const reply = await onSubmit(trimmed);
    if (reply) {
      setMessage('');
    }
  }, [message, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (isDisabled) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <Lock className="size-3.5 shrink-0" />
        This ticket is closed. You cannot send new replies.
      </div>
    );
  }

  const charCount = message.length;
  const modKey = isMac ? '\u2318' : 'Ctrl';

  return (
    <div className="mt-6 space-y-2">
      <Textarea
        placeholder="Type your reply..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_LENGTH}
        disabled={isSubmitting}
        className="min-h-24 resize-none"
        aria-label="Reply message"
      />
      <div className="flex items-center justify-between">
        <p
          className={cn(
            'text-xs text-muted-foreground',
            charCount > 4800 && 'text-amber-600 dark:text-amber-400',
            charCount >= MAX_LENGTH && 'text-destructive',
          )}
        >
          {charCount > 0 && `${charCount.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            {modKey}+Enter
          </kbd>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="size-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
