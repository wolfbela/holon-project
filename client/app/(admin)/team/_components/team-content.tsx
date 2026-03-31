'use client';

import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Users, UserPlus } from 'lucide-react';
import type { User, RegisterInput } from '@shared/types/user';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { TeamTable } from './team-table';
import { TeamCard } from './team-card';
import {
  TeamTableSkeleton,
  TeamCardSkeleton,
} from './team-table-skeleton';
import { AddAdminDialog } from './add-admin-dialog';
import { DeleteAdminDialog } from './delete-admin-dialog';

export function TeamContent() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const {
    users,
    isLoading,
    hasError,
    isCreating,
    isDeleting,
    createUser,
    deleteUser,
    retry,
  } = useAdminUsers();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const handleDeleteRequest = useCallback((admin: User) => {
    setDeleteTarget(admin);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteUser]);

  const handleCreateUser = useCallback(
    async (input: RegisterInput) => {
      return createUser(input);
    },
    [createUser],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="mt-1 text-muted-foreground">
              Manage administrator accounts.
            </p>
          </div>
          {!isLoading && !hasError && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="size-4" />
              Add Admin
            </Button>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className="mt-6">
        {hasError && !isLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <p className="text-lg font-medium text-foreground">
              Something went wrong
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Could not load team members.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2 rounded-full"
              onClick={retry}
            >
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          </motion.div>
        ) : isLoading ? (
          isMobile ? (
            <TeamCardSkeleton />
          ) : (
            <TeamTableSkeleton />
          )
        ) : users.length <= 1 ? (
          <EmptyState
            icon={Users}
            title="No other admins"
            description="You're the only administrator. Add team members to help manage the platform."
            action={
              <Button onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="size-4" />
                Add Admin
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? 'admin' : 'admins'}
            </p>
            {isMobile ? (
              <div className="flex flex-col gap-4">
                {users.map((u, i) => (
                  <TeamCard
                    key={u.id}
                    admin={u}
                    isSelf={u.id === user?.id}
                    delay={Math.min(i * 0.05, 0.5)}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </div>
            ) : (
              <TeamTable
                admins={users}
                currentUserId={user?.id}
                onDelete={handleDeleteRequest}
              />
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <AddAdminDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreateUser}
        isCreating={isCreating}
      />
      <DeleteAdminDialog
        admin={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
