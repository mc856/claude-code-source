export type ViewState =
  | {
      type: 'menu';
    }
  | {
      type: 'help';
    }
  | {
      type: 'validate';
      path?: string;
    }
  | {
      type: 'browse-marketplace';
      targetMarketplace: string;
      targetPlugin?: string;
    }
  | {
      type: 'discover-plugins';
      targetPlugin?: string;
    }
  | {
      type: 'manage-plugins';
      targetPlugin?: string;
      targetMarketplace?: string;
      action?: 'enable' | 'disable' | 'uninstall';
    }
  | {
      type: 'marketplace-list';
    }
  | {
      type: 'add-marketplace';
      initialValue?: string;
    }
  | {
      type: 'manage-marketplaces';
      targetMarketplace?: string;
      action?: 'update' | 'remove';
    }
  | {
      type: 'marketplace-menu';
    };

export type PluginSettingsProps = {
  onComplete: (result?: string, options?: {
    shouldQuery?: boolean;
  }) => void;
  args?: string;
  showMcpRedirectMessage?: boolean;
};
