import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { Flexbox } from '@lobehub/ui';
import { type FC, useState } from 'react';
import { Link } from 'react-router-dom';

import BusinessPanelContent from '@/business/client/features/User/BusinessPanelContent';
import BrandWatermark from '@/components/BrandWatermark';
import Menu from '@/components/Menu';
import UsagePanel from '@/components/UsagePanel';
import { isDesktop } from '@/const/version';
import { navigateToDesktopOnboarding } from '@/routes/(desktop)/desktop-onboarding/navigation';
import { DesktopOnboardingScreen } from '@/routes/(desktop)/desktop-onboarding/types';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

import DataStatistics from '../DataStatistics';
import UserInfo from '../UserInfo';
import UserLoginOrSignup from '../UserLoginOrSignup';
import LangButton from './LangButton';
import { useMenu } from './useMenu';

const PanelContent: FC<{ closePopover: () => void }> = ({ closePopover }) => {
  const isLoginWithAuth = useUserStore(authSelectors.isLoginWithAuth);
  const [openSignIn, signOut] = useUserStore((s) => [s.openLogin, s.logout]);
  const { mainItems, logoutItems } = useMenu();
  const [usageOpen, setUsageOpen] = useState(false);

  const handleSignIn = () => {
    openSignIn();
    closePopover();
  };

  const handleSignOut = async () => {
    if (isDesktop) {
      closePopover();

      try {
        const { remoteServerService } = await import('@/services/electron/remoteServer');
        await remoteServerService.clearRemoteServerConfig();
      } catch (error) {
        console.error(error);
      } finally {
        signOut();
        navigateToDesktopOnboarding(DesktopOnboardingScreen.Login);
      }
      return;
    }

    signOut();
    closePopover();
  };

  return (
    <Flexbox gap={2} style={{ minWidth: 300 }}>
      {isDesktop || isLoginWithAuth ? (
        <>
          <UserInfo avatarProps={{ clickable: false }} />
          <Link style={{ color: 'inherit' }} to={'/settings/stats'}>
            <DataStatistics />
          </Link>
          {ENABLE_BUSINESS_FEATURES && <BusinessPanelContent />}
        </>
      ) : (
        <UserLoginOrSignup onClick={handleSignIn} />
      )}

      <Menu
        items={mainItems}
        onClick={(info) => {
          if (info.key === 'usage') {
            setUsageOpen(true);
            return;
          }
          closePopover();
        }}
      />
      <Menu items={logoutItems} onClick={handleSignOut} />
      <Flexbox horizontal gap={4} justify={'space-between'} style={{ padding: '6px 8px 6px 16px' }}>
        <BrandWatermark />
        <LangButton placement={'right' as any} />
      </Flexbox>
      <UsagePanel open={usageOpen} onClose={() => setUsageOpen(false)} />
    </Flexbox>
  );
};

export default PanelContent;
