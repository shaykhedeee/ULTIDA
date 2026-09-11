import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from 'react';

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'primary' | 'secondary' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
};

export function Button({ className, variant = 'default', size = 'md', icon, children, ...props }: ButtonProps) {
  const resolvedVariant = variant === 'primary' ? 'default' : variant === 'secondary' ? 'outline' : variant;
  return (
    <button className={cn('ui-button', `ui-button-${resolvedVariant}`, `ui-button-${size}`, className)} {...props}>
      {icon && <span className="ui-btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-card', className)} {...props} />;
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-card-header', className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-card-content', className)} {...props} />;
}

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-glass-card', className)} {...props} />;
}

export function Badge({
  children,
  className,
  tone,
  variant
}: PropsWithChildren<{
  className?: string;
  tone?: 'neutral' | 'success' | 'accent' | 'warn' | 'gold';
  variant?: 'default' | 'success' | 'warning' | 'info' | 'muted' | 'error' | 'gold';
}>) {
  const resolvedTone = tone ?? (
    variant === 'success' ? 'success' :
    variant === 'warning' ? 'warn' :
    variant === 'info' ? 'accent' :
    variant === 'gold' ? 'gold' :
    'neutral'
  );
  return <span className={cn('ui-badge', `ui-badge-${resolvedTone}`, className)}>{children}</span>;
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('ui-separator', className)} role="separator" />;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  delta,
  tone = 'neutral',
  className
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  delta?: string;
  tone?: 'neutral' | 'success' | 'warn' | 'accent' | 'gold';
  className?: string;
}) {
  return (
    <div className={cn('ui-stat-card', `tone-${tone}`, className)}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-body">
        <strong className="stat-value">{value}</strong>
        {delta && <span className="stat-delta">{delta}</span>}
      </div>
      {subtitle && <span className="stat-sub">{subtitle}</span>}
    </div>
  );
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  className
}: {
  items: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('ui-tabs-track', className)} role="tablist">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('ui-tab-btn', active && 'active')}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <span className="tab-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && <span className="tab-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ui-empty-state', className)}>
      {icon && <div className="empty-icon-wrap">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      <p className="empty-desc">{description}</p>
      {action && <div className="empty-action-wrap">{action}</div>}
    </div>
  );
}

export function Skeleton({
  className,
  width,
  height,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { width?: string | number; height?: string | number }) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
