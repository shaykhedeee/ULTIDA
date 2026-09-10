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

export interface WorkflowDockAction {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export interface WorkflowDockProps {
  currentStageIndex: number;
  totalStages?: number;
  stageTitle: string;
  stageSummary?: string;
  prevAction?: WorkflowDockAction;
  nextAction?: WorkflowDockAction;
  secondaryAction?: WorkflowDockAction;
  beaconTone?: 'gold' | 'success' | 'accent';
  extraContent?: ReactNode;
}

export function WorkflowDock({
  currentStageIndex,
  totalStages = 8,
  stageTitle,
  stageSummary,
  prevAction,
  nextAction,
  secondaryAction,
  beaconTone = 'gold',
  extraContent,
}: WorkflowDockProps) {
  const beaconColor = beaconTone === 'success' ? '#10b981' : beaconTone === 'accent' ? '#f59e0b' : '#c59c2d';

  return (
    <nav
      className="workflow-dock"
      aria-label="Workflow Stage Navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        minHeight: 54,
        padding: '0 24px',
        background: 'rgba(20, 18, 16, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(197, 156, 45, 0.28)',
        boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* Left Info & Stage Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: '8px 0' }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: beaconColor,
            boxShadow: `0 0 10px ${beaconColor}`,
            flexShrink: 0,
            animation: 'beaconPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#e8c96a',
                background: 'rgba(197, 156, 45, 0.16)',
                border: '1px solid rgba(197, 156, 45, 0.3)',
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              Stage {currentStageIndex} of {totalStages}
            </span>
            <strong
              style={{
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {stageTitle}
            </strong>
          </div>
          {stageSummary && (
            <span
              style={{
                color: '#a8a29e',
                fontSize: 11.5,
                display: 'block',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '650px',
              }}
            >
              {stageSummary}
            </span>
          )}
        </div>
      </div>

      {/* Center Optional Extra Content */}
      {extraContent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extraContent}
        </div>
      )}

      {/* Right Action Buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
        {secondaryAction && (
          <button
            type="button"
            onClick={() => void secondaryAction.onClick()}
            disabled={secondaryAction.disabled || secondaryAction.loading}
            style={{
              background: '#24201c',
              color: '#d6d3d1',
              border: '1px solid #443c35',
              borderRadius: 7,
              padding: '7px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: secondaryAction.disabled ? 'not-allowed' : 'pointer',
              opacity: secondaryAction.disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              transition: 'all 0.15s ease',
            }}
          >
            {secondaryAction.icon}
            <span>{secondaryAction.label}</span>
          </button>
        )}

        {prevAction && (
          <button
            type="button"
            onClick={() => void prevAction.onClick()}
            disabled={prevAction.disabled || prevAction.loading}
            style={{
              background: '#2b2622',
              color: '#f5f5f4',
              border: '1px solid #4a3e33',
              borderRadius: 7,
              padding: '7px 14px',
              fontWeight: 600,
              fontSize: 12,
              cursor: prevAction.disabled ? 'not-allowed' : 'pointer',
              opacity: prevAction.disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              transition: 'all 0.15s ease',
            }}
          >
            {prevAction.icon}
            <span>{prevAction.label}</span>
          </button>
        )}

        {nextAction && (
          <button
            type="button"
            onClick={() => void nextAction.onClick()}
            disabled={nextAction.disabled || nextAction.loading}
            style={{
              background: 'linear-gradient(135deg, #c59c2d, #92400e)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 7,
              padding: '7px 18px',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: nextAction.disabled ? 'not-allowed' : 'pointer',
              opacity: nextAction.disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              boxShadow: '0 2px 10px rgba(197, 156, 45, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{nextAction.loading ? 'Processing…' : nextAction.label}</span>
            {nextAction.icon}
          </button>
        )}
      </div>
    </nav>
  );
}

