import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React from 'react';
import { Text } from '../../ink.js';

type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading';

type Props = {
  /**
   * The status to display. Determines both the icon and color.
   */
  status: Status;
  /**
   * Include a trailing space after the icon. Useful when followed by text.
   * @default false
   */
  withSpace?: boolean;
};

const STATUS_CONFIG: Record<Status, {
  icon: string;
  color: 'success' | 'error' | 'warning' | 'suggestion' | undefined;
}> = {
  success: { icon: figures.tick, color: 'success' },
  error: { icon: figures.cross, color: 'error' },
  warning: { icon: figures.warning, color: 'warning' },
  info: { icon: figures.info, color: 'suggestion' },
  pending: { icon: figures.circle, color: undefined },
  loading: { icon: '...', color: undefined },
};

export function StatusIcon(t0: Props): React.ReactNode {
  const $ = _c(5);
  const {
    status,
    withSpace: t1,
  } = t0;
  const withSpace = t1 === undefined ? false : t1;
  const config = STATUS_CONFIG[status];
  const t2 = !config.color;
  const t3 = withSpace && ' ';
  let t4;
  if ($[0] !== config.color || $[1] !== config.icon || $[2] !== t2 || $[3] !== t3) {
    t4 = <Text color={config.color} dimColor={t2}>{config.icon}{t3}</Text>;
    $[0] = config.color;
    $[1] = config.icon;
    $[2] = t2;
    $[3] = t3;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  return t4;
}
