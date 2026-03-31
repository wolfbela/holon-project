'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterInput } from '@shared/types/user';
import { Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RegisterInput) => Promise<boolean>;
  isCreating: boolean;
}

export function AddAdminDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
}: AddAdminDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
  }

  async function onFormSubmit(data: RegisterInput) {
    const success = await onSubmit(data);
    if (success) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Add Admin
          </DialogTitle>
          <DialogDescription>
            Create a new administrator account. They will be able to manage
            tickets and team members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-name">Name</Label>
            <Input
              id="admin-name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@company.com"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Must be at least 6 characters
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Admin'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
