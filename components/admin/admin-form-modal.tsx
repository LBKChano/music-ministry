import React, { ReactNode } from 'react';
import {
  AppModal,
  type AppModalAction,
} from '@/components/ui/app-modal';
import type { AppModalVariant } from '@/lib/ui/modal-presentation';

type AdminFormModalProps = {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryAction: AppModalAction;
  secondaryAction?: AppModalAction;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  primaryColor?: string;
  maxWidth?: number;
  maxRestingHeight?: number;
  variant?: AppModalVariant;
  bodyScroll?: boolean;
  headerIcon?: ReactNode;
};

export function AdminFormModal({
  visible,
  title,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  maxWidth,
  maxRestingHeight,
  variant = 'form',
  bodyScroll = true,
  headerIcon,
}: AdminFormModalProps) {
  return (
    <AppModal
      bodyScroll={bodyScroll}
      headerIcon={headerIcon}
      maxHeight={maxRestingHeight}
      maxWidth={maxWidth}
      onClose={onClose}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      title={title}
      variant={variant}
      visible={visible}
    >
      {children}
    </AppModal>
  );
}
