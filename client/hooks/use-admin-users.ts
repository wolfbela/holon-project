'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, RegisterInput } from '@shared/types/user';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

export function useAdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fetchedRef = useRef(false);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      const data = await apiClient.get<User[]>('/admin/users');
      setUsers(data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load team members.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(
    async (input: RegisterInput): Promise<boolean> => {
      try {
        setIsCreating(true);
        const newUser = await apiClient.post<User>('/admin/users', input);
        setUsers((prev) => [newUser, ...prev]);
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
    [],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      const previousUsers = users;
      setUsers((prev) => prev.filter((u) => u.id !== id));
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
    [users],
  );

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchUsers();
  }, [fetchUsers]);

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
