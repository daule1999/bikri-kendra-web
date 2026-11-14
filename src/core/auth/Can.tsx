'use client';

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useHasPermission, type PermissionRequirement } from './hooks';

type CanProps = {
  /** Permission(s) required. */
  perform: PermissionRequirement;
  /**
   * What to do when not allowed:
   *  - 'hide'    (default) render `fallback` (or nothing)
   *  - 'disable' render the child disabled, with `disabledReason` as its tooltip
   */
  mode?: 'hide' | 'disable';
  fallback?: ReactNode;
  disabledReason?: string;
  children: ReactNode | ((allowed: boolean) => ReactNode);
};

/**
 * Element-level permission gate.
 *
 *   <Can perform={PERMISSIONS.usersManage}><Button>Add user</Button></Can>
 *   <Can perform={PERMISSIONS.stockHistoryModify} mode="disable"><Button>Rollback</Button></Can>
 *   <Can perform={{ anyOf: [A, B] }}>{(ok) => ok ? <Edit/> : <ReadOnly/>}</Can>
 */
export function Can({ perform, mode = 'hide', fallback = null, disabledReason = "You don't have permission for this action", children }: CanProps) {
  const allowed = useHasPermission(perform);

  if (typeof children === 'function') return <>{children(allowed)}</>;
  if (allowed) return <>{children}</>;

  if (mode === 'disable' && isValidElement(children)) {
    const el = children as ReactElement<{ disabled?: boolean; title?: string; 'aria-disabled'?: boolean }>;
    return cloneElement(el, { disabled: true, 'aria-disabled': true, title: disabledReason });
  }
  return <>{fallback}</>;
}
