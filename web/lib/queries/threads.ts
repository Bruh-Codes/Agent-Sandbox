import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { threadsApi, type ThreadListItem, type ThreadListResult } from "@/lib/api/threads";

export function useThreadList(
  options?: Partial<UseQueryOptions<ThreadListResult>>,
) {
  return useQuery({
    queryKey: queryKeys.threads.list(),
    queryFn: threadsApi.list,
    ...options,
  });
}

export function useThread(
  id: string | undefined,
  options?: Partial<UseQueryOptions<ThreadListItem | null>>,
) {
  return useQuery({
    queryKey: queryKeys.threads.detail(id!),
    queryFn: () => threadsApi.get(id!),
    enabled: !!id,
    ...options,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: threadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}

export function useRenameThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      threadsApi.rename(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(id) });
      queryClient.setQueryData(queryKeys.threads.detail(id), (old: ThreadListItem | null) =>
        old ? { ...old, title } : old,
      );
      const listData = queryClient.getQueryData<ThreadListResult>(queryKeys.threads.list());
      if (listData) {
        queryClient.setQueryData(queryKeys.threads.list(), {
          threads: listData.threads.map((t) =>
            t.remoteId === id ? { ...t, title } : t,
          ),
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useArchiveThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => threadsApi.archive(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(id) });
      queryClient.setQueryData(queryKeys.threads.detail(id), (old: ThreadListItem | null) =>
        old ? { ...old, status: "archived" as const } : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useUnarchiveThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => threadsApi.unarchive(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(id) });
      queryClient.setQueryData(queryKeys.threads.detail(id), (old: ThreadListItem | null) =>
        old ? { ...old, status: "regular" as const } : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => threadsApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.list() });
      const listData = queryClient.getQueryData<ThreadListResult>(queryKeys.threads.list());
      if (listData) {
        queryClient.setQueryData(queryKeys.threads.list(), {
          threads: listData.threads.filter((t) => t.remoteId !== id),
        });
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.threads.all });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}

export function useGenerateTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, messages }: { id: string; messages: readonly unknown[] }) =>
      threadsApi.generateTitle(id, messages),
    onSuccess: (title, { id }) => {
      queryClient.setQueryData(queryKeys.threads.detail(id), (old: ThreadListItem | null) =>
        old ? { ...old, title } : old,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
    },
  });
}
