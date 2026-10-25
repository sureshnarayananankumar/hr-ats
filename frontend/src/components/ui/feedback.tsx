import * as ToastPrimitive from '@radix-ui/react-toast';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './primitives';

// =====================================================================
//  Toasts
// =====================================================================

type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(() => {
    const toast: ToastContextValue['toast'] = ({ title, description, tone = 'info' }) => {
      const id = nextToastId++;
      setItems((current) => [...current, { id, title, description, tone }]);
    };
    return {
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
    };
  }, []);

  const toneClass: Record<ToastTone, string> = {
    info: 'border-info/40 bg-card',
    success: 'border-success/40 bg-card',
    warning: 'border-warning/40 bg-card',
    error: 'border-destructive/40 bg-card',
  };

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && dismiss(item.id)}
            className={cn(
              'grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border p-4 shadow-lg',
              'data-[state=open]:animate-slide-up',
              toneClass[item.tone],
            )}
          >
            <div className="space-y-1">
              <ToastPrimitive.Title className="text-sm font-medium">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          className="fixed bottom-0 right-0 z-[70] flex w-full max-w-sm flex-col gap-2 p-4"
          // Announced politely so a toast never interrupts a screen
          // reader mid-sentence.
          label="Notifications"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}

// =====================================================================
//  Dialog
// =====================================================================

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'max-h-[85vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg',
            'data-[state=open]:animate-slide-up',
            widths,
          )}
        >
          <div className="mb-4 space-y-1 pr-8">
            <DialogPrimitive.Title className="text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            {/* Radix warns without a description; render it only when given. */}
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>

          {children}

          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}

          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close dialog"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Confirmation prompt for consequential actions.
 * Used before anything irreversible or outward-facing: publishing a job,
 * rejecting a candidate, sending an offer, bulk transitions.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  isLoading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            onClick={() => void onConfirm()}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'destructive' && (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        )}
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
    </Dialog>
  );
}
