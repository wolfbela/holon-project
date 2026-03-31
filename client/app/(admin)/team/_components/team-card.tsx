'use client';

import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';
import type { User } from '@shared/types/user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDate, getInitials } from '@/lib/format';

interface TeamCardProps {
  admin: User;
  isSelf: boolean;
  delay?: number;
  onDelete: (admin: User) => void;
}

export function TeamCard({ admin, isSelf, delay = 0, onDelete }: TeamCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-4 rounded-xl p-4 ring-1 ring-foreground/10 transition-all duration-300 hover:shadow-sm">
        <Avatar>
          <AvatarFallback>{getInitials(admin.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{admin.name}</span>
            {isSelf && (
              <span className="text-xs text-muted-foreground">(You)</span>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {admin.email}
          </p>
          <time className="text-xs text-muted-foreground">
            Added {formatDate(admin.created_at)}
          </time>
        </div>
        {!isSelf && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${admin.name}`}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(admin)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
