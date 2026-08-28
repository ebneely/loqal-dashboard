/**
 * The domain layer. Everything here is a composition of shadcn primitives —
 * src/components/ui is CLI output and is never hand-written — and every file
 * names the primitives it is built from in its header comment, so the rule
 * stays checkable in review.
 */
export { AppShell, visibleNavItems } from "./app-shell";
export type {
  AppShellNavGroup,
  AppShellNavItem,
  AppShellProps,
  AppShellRole,
} from "./app-shell";

export { DestructiveSheet } from "./destructive-sheet";
export type { DestructiveSheetProps } from "./destructive-sheet";

export { DataField, FieldGrid, Kpi, KpiGrid, SectionHead } from "./layout";

export { InviteResult } from "./invite-result";
export type {
  InviteResultLabels,
  InviteResultProps,
  InviteResultStep,
  InviteStepOutcome,
} from "./invite-result";

export { ListState, listStateFor } from "./list-state";
export type { ListStateKind, ListStateProps } from "./list-state";

export { MobileActionBar, MobileActionBarSpacer } from "./mobile-action-bar";
export type { MobileActionBarProps } from "./mobile-action-bar";

export { MoneyRow } from "./money-row";
export type { MoneyRowPerspective, MoneyRowProps } from "./money-row";

export { adminNav, brandNav, brandTabs, salesNav } from "./nav";
export type { NavCounts } from "./nav";

export { ResponsiveList } from "./responsive-list";
export type {
  ResponsiveListColumn,
  ResponsiveListProps,
} from "./responsive-list";

export {
  StatusPill,
  STATUS_MAP,
  DELIVERY_TONE,
  PAYMENT_TONE,
  statusLabel,
  statusTone,
} from "./status-pill";
export type {
  DeliveryMethodLabels,
  LiveDeliveryMethod,
  MethodPillProps,
  PaymentMethodLabels,
  StatusEnumName,
  StatusPillProps,
  StatusTone,
} from "./status-pill";
