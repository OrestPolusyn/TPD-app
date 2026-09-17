export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramWebAppButton {
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  setText(text: string): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  isVisible: boolean;
}

export interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
  isVisible: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string; auth_date?: number; hash?: string };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  ready(): void;
  expand(): void;
  MainButton: TelegramWebAppButton;
  BackButton: TelegramBackButton;
  onEvent(event: string, callback: () => void): void;
  offEvent(event: string, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
