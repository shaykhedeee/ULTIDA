import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react';

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(' '); }

export function Button({ className, variant = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' }) {
  return <button className={cn('ui-button', `ui-button-${variant}`, className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card', className)} {...props} />; }
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card-header', className)} {...props} />; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('ui-card-content', className)} {...props} />; }
export function Badge({ children, className, tone = 'neutral' }: PropsWithChildren<{ className?: string; tone?: 'neutral' | 'success' | 'accent' }>) { return <span className={cn('ui-badge', `ui-badge-${tone}`, className)}>{children}</span>; }
export function Separator({ className }: { className?: string }) { return <div className={cn('ui-separator', className)} role="separator" />; }
