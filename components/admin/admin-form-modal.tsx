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
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  primaryColor: string;
  maxWidth?: number;
  maxRestingHeight?: number;
  variant?: AppModalVariant;
  bodyScroll?: boolean;
};

export function AdminFormModal({
  visible,
  title,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  backgroundColor,
  textColor,
  borderColor,
  primaryColor,
  maxWidth,
  maxRestingHeight,
  variant = 'form',
  bodyScroll = true,
}: AdminFormModalProps) {
  return (
    <AppModal
      backgroundColor={backgroundColor}
      bodyScroll={bodyScroll}
      borderColor={borderColor}
      maxHeight={maxRestingHeight}
      maxWidth={maxWidth}
      onClose={onClose}
      primaryAction={primaryAction}
      primaryColor={primaryColor}
      secondaryAction={secondaryAction}
      textColor={textColor}
      title={title}
      variant={variant}
      visible={visible}
    >
      {children}
    </AppModal>
  );
}
