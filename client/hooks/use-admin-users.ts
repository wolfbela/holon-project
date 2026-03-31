'use client';

import { useState, useCallback } from 'react';
import type { User, RegisterInput } from '@shared/types/user';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { useFetch } from './use-fetch';

export function useAdminUsers() {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetcher = useCallback(() => apiClient.get<User[]>('/admin/users'), []);

  const {
    data,
    isLoading,
    hasError,
    retry,
    setData: setUsers,
  } = useFetch({
    fetcher,
    errorMessage: 'Failed to load team members.',
  });

  const users: User[] = data ?? [];

  const createUser = useCallback(
    async (input: RegisterInput): Promise<boolean> => {
      try {
        setIsCreating(true);
        const newUser = await apiClient.post<User>('/admin/users', input);
        setUsers((prev: User[]) => [newUser, ...(prev ?? [])]);
        toast.success('Admin added successfully.');
        return true;
      } catch (error) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to add admin.');
        }
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [setUsers],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      const previousUsers = users;
      setUsers((prev: User[]) => (prev ?? []).filter((u) => u.id !== id));
      try {
        setIsDeleting(true);
        await apiClient.del(`/admin/users/${id}`);
        toast.success('Admin removed.');
      } catch (error) {
        setUsers(previousUsers);
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to remove admin.');
        }
      } finally {
        setIsDeleting(false);
      }
    },
    [users, setUsers],
  );

  return {
    users,
    isLoading,
    hasError,
    isCreating,
    isDeleting,
    createUser,
    deleteUser,
    retry,
  };
}
