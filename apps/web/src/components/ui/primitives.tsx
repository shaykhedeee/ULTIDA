import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from 'react';

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(' '); }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ className, variant = 'default', size = 'md', icon, children, ...props }: ButtonProps) {
  const resolvedVariant = variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : variant;
  return <button className={cn('ui-button', `ui-button-${resolvedVariant}`, `ui-button-${size}`, className)} {...props}>{icon}{children}</button>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card', className)} {...props} />; }
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card-header', className)} {...props} />; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card-content', className)} {...props} />; }
export function Badge({ children, className, tone, variant }: PropsWithChildren<{ className?: string; tone?: 'neutral' | 'success' | 'accent' | 'warn'; variant?: 'default' | 'success' | 'warning' | 'info' | 'muted' | 'error' }>) {
  const resolvedTone = tone ?? (variant === 'success' ? 'success' : variant === 'warning' ? 'warn' : variant === 'info' ? 'accent' : 'neutral');
  return <span className={cn('ui-badge', `ui-badge-${resolvedTone}`, className)}>{children}</span>;
}
export function Separator({ className }: { className?: string }) { return <div className={cn('ui-separator', className)} role="separator" />; }
