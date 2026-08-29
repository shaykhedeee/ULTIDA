# Layouts

## `apps/web/src/Shell.tsx`
The application shell provides primary studio navigation, project workflow navigation, a command bar, and responsive mobile navigation.

```tsx
export function Shell({ children, sessionEmail, orgName, projectId, projectName, workflowStages = DEFAULT_WORKFLOW_STAGES, onNewProject }: Props) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('ultida-sidebar-collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  return <div className={`ultida-shell${collapsed ? ' sidebar-collapsed' : ''}`}><aside className={`primary-sidebar${mobileOpen ? ' mobile-open' : ''}`}>{/* brand, navigation, workflow and account */}</aside><main className="shell-main"><div className="command-bar">{/* project context and actions */}</div><div className="shell-content">{children}</div></main></div>;
}
```
