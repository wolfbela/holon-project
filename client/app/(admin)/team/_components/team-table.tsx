'use client';

import { Trash2 } from 'lucide-react';
import type { User } from '@shared/types/user';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDate, getInitials } from '@/lib/format';

interface TeamTableProps {
  admins: User[];
  currentUserId?: string;
  onDelete: (admin: User) => void;
}

export function TeamTable({
  admins,
  currentUserId,
  onDelete,
}: TeamTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Date Added</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => {
            const isSelf = admin.id === currentUserId;
            return (
              <TableRow
                key={admin.id}
                className="transition-colors hover:bg-muted/50"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(admin.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{admin.name}</span>
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {admin.email}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(admin.created_at)}
                </TableCell>
                <TableCell>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${admin.name}`}
                      title={`Delete ${admin.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(admin);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
