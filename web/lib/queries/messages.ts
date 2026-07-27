import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { messagesApi, type MessageRow } from "@/lib/api/messages";

export function useMessageList(
  threadId: string | undefined,
  options?: Partial<UseQueryOptions<MessageRow[]>>,
) {
  return useQuery({
    queryKey: queryKeys.messages.list(threadId!),
    queryFn: () => messagesApi.list(threadId!),
    enabled: !!threadId,
    ...options,
  });
}

export function useAppendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      ...body
    }: {
      threadId: string;
      id: string;
      parent_id: string | null;
      format: string;
      content: unknown;
    }) => messagesApi.append(threadId, body),
    onMutate: async ({ threadId, ...body }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(threadId),
      });
      const prev = queryClient.getQueryData<MessageRow[]>(
        queryKeys.messages.list(threadId),
      );
      if (prev) {
        queryClient.setQueryData<MessageRow[]>(
          queryKeys.messages.list(threadId),
          [
            ...prev,
            {
              id: body.id,
              threadId,
              parentId: body.parent_id,
              format: body.format,
              content: body.content as never,
              createdAt: new Date().toISOString(),
            },
          ],
        );
      }
      return { prev };
    },
    onError: (_err, { threadId }, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          queryKeys.messages.list(threadId),
          ctx.prev,
        );
      }
    },
    onSettled: (_data, _err, { threadId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(threadId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads.list(),
      });
    },
  });
}
