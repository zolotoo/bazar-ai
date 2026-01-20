/// <reference types="vite/client" />

interface Window {
  Telegram?: {
    WebApp: {
      initData: string;
      initDataUnsafe: any;
      version: string;
      platform: string;
      colorScheme: 'light' | 'dark';
      themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
        secondary_bg_color?: string;
      };
      isExpanded: boolean;
      viewportHeight: number;
      viewportStableHeight: number;
      headerColor: string;
      backgroundColor: string;
      isClosingConfirmationEnabled: boolean;
      BackButton: {
        isVisible: boolean;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
        show: () => void;
        hide: () => void;
      };
      MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        isProgressVisible: boolean;
        setText: (text: string) => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        showProgress: (leaveActive?: boolean) => void;
        hideProgress: () => void;
        setParams: (params: {
          text?: string;
          color?: string;
          text_color?: string;
          is_active?: boolean;
          is_visible?: boolean;
        }) => void;
      };
      HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        selectionChanged: () => void;
      };
      CloudStorage: any;
      BiometricManager: any;
      ready: () => void;
      expand: () => void;
      close: () => void;
      sendData: (data: string) => void;
      openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
      openTelegramLink: (url: string) => void;
      openInvoice: (url: string, callback?: (status: string) => void) => void;
      showPopup: (params: {
        title?: string;
        message: string;
        buttons?: Array<{
          id?: string;
          type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
          text: string;
        }>;
      }, callback?: (id: string) => void) => void;
      showAlert: (message: string, callback?: () => void) => void;
      showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
      showScanQrPopup: (params: {
        text?: string;
      }, callback?: (data: string) => void) => void;
      closeScanQrPopup: () => void;
      readTextFromClipboard: (callback?: (text: string) => void) => void;
      requestWriteAccess: (callback?: (granted: boolean) => void) => void;
      requestContact: (callback?: (granted: boolean) => void) => void;
      invokeCustomMethod: (method: string, params: Record<string, any>, callback?: (error: any, result: any) => void) => void;
      enableClosingConfirmation: () => void;
      disableClosingConfirmation: () => void;
      onEvent: (eventType: string, eventHandler: () => void) => void;
      offEvent: (eventType: string, eventHandler: () => void) => void;
      version: string;
      platform: string;
      colorScheme: 'light' | 'dark';
      themeParams: any;
      isExpanded: boolean;
      viewportHeight: number;
      viewportStableHeight: number;
      headerColor: string;
      backgroundColor: string;
      BackButton: any;
      MainButton: any;
      HapticFeedback: any;
    };
  };
}
