import React from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { resolveRoleSymbol } from '@/lib/roles/role-symbols';

export function RoleSymbol({
  iconKey,
  color,
  size = 20,
}: {
  iconKey?: string | null;
  color: string;
  size?: number;
}) {
  const symbol = resolveRoleSymbol(iconKey);

  return (
    <IconSymbol
      android_material_icon_name={symbol.androidIcon}
      color={color}
      ios_icon_name={symbol.iosIcon}
      size={size}
    />
  );
}
