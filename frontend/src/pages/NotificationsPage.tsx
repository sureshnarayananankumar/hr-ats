import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import type { Notification, Paginated } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/feedback';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () =>
      api.get<Paginated<Notification> & { unreadCount: number }>('/notifications', {
        pageSize: 50,
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch<{ updated: number }>('/notifications/read-all'),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.updated} notification(s) marked as read`);
    },
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          data ? `${data.unreadCount} unread of ${data.meta.totalItems}` : 'Your in-app notifications.'
        }
        actions={
          data && data.unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              isLoading={markAllRead.isPending}
              leftIcon={<CheckCheck />}
            >
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff className="size-6" />}
            title="No notifications"
            description="Approvals, interview invitations and status changes will appear here."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {data!.data.map((notification) => {
                const body = (
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {!notification.readAt && (
                          <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                        {notification.title}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2">
                        {notification.category && <Badge>{notification.category}</Badge>}
                        <time className="text-xs text-muted-foreground" dateTime={notification.createdAt}>
                          {formatRelative(notification.createdAt)}
                        </time>
                      </div>
                    </div>
                    {!notification.readAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.preventDefault();
                          markRead.mutate(notification.id);
                        }}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                );

                return (
                  <li key={notification.id} className={notification.readAt ? '' : 'bg-primary/5'}>
                    {notification.link ? (
                      <Link
                        to={notification.link}
                        onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                        className="block hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
