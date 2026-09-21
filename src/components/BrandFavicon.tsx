import { useEffect } from 'react';
import { useBranding } from '../settings/BrandingContext';

export default function BrandFavicon() {
  const { branding } = useBranding();

  useEffect(() => {
    const logo = branding?.logoUrl || '';
    const version = encodeURIComponent(`${logo.length}-${logo.slice(-24)}`);
    const href = `/api/pwa/icon?size=64&v=${version}`;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
    if (links.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
      link.href = href;
      return;
    }
    links.forEach((link) => { link.href = href; });
  }, [branding?.logoUrl]);

  return null;
}
