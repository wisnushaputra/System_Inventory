import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps): IconProps {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function NimsBrandMark({ className = 'h-7 w-7', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="24" height="24" rx="6" className="fill-accent" />
      <path
        d="M9 18V10l10 8V10"
        stroke="currentColor"
        className="text-accent-fg"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1.75" className="fill-accent-fg" />
      <circle cx="9" cy="18" r="1.75" className="fill-accent-fg" />
      <circle cx="19" cy="10" r="1.75" className="fill-accent-fg" />
      <circle cx="19" cy="18" r="1.75" className="fill-accent-fg" />
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="3" width="8" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

export function IconServer(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" />
    </svg>
  );
}

export function IconTopology(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="9" y="3" width="6" height="5" rx="1.2" />
      <rect x="3" y="16" width="6" height="5" rx="1.2" />
      <rect x="15" y="16" width="6" height="5" rx="1.2" />
      <path d="M12 8v4M12 12H6v4M12 12h6v4" />
    </svg>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <ellipse cx="12" cy="5.5" rx="8" ry="2.5" />
      <path d="M4 5.5v6.5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5.5" />
      <path d="M4 12v6.5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V12" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 5.5a2.8 2.8 0 0 1 0 5.4M17 14c2.4.4 4 2 4 4.5" />
    </svg>
  );
}

export function IconAudit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M4 7h16M4 12h16M4 17h12" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconPanelCollapse(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 9l-3 3 3 3" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
    </svg>
  );
}

export function IconPopBuilding(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 10h4v11M2 21h20" />
      <path d="M8 7h4M8 11h4M8 15h4M10 21v-3" />
    </svg>
  );
}

export function IconSitePin(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function IconCustomerGroup(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M3 20v-7l6-3v10M9 20V5l6-2v17M15 20V9l6 3v8M2 20h20" />
    </svg>
  );
}

export function IconSubnetGlobe(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
    </svg>
  );
}

export function IconLinkCable(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M10 13a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 11a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </svg>
  );
}

export function IconRouter(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3" />
      <path d="M10.5 8l1.5-1.5L13.5 8M10.5 16l1.5 1.5L13.5 16M8 10.5L6.5 12 8 13.5M16 10.5l1.5 1.5-1.5 1.5" />
    </svg>
  );
}

export function IconSwitch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h6M11 8l2 2-2 2M17 14h-6M13 12l-2 2 2 2" />
    </svg>
  );
}

export function IconOlt(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9.5h2M7 14.5h2M13 9.5h4M13 14.5h4M11 9.5v5" />
    </svg>
  );
}

export function IconOnt(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="4" y="11" width="16" height="8" rx="1.5" />
      <path d="M8 11V6M16 11V7M8 15h2M12 15h4" />
    </svg>
  );
}

export function IconRadio(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="11" r="1.5" />
      <path d="M12 12.5V20M9 20h6" />
      <path d="M8.5 14.5a5 5 0 0 1 0-7M15.5 7.5a5 5 0 0 1 0 7M5.5 17a9 9 0 0 1 0-12M18.5 5a9 9 0 0 1 0 12" />
    </svg>
  );
}

export function IconFirewall(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3z" />
      <path d="M8.5 12h7M12 8.5v7" />
    </svg>
  );
}

export function IconHardwareBox(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}

export function IconCog(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconFileDoc(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4M8.5 12h7M8.5 16h5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.8-3.8" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 4v11M7 11l5 5 5-5M4 19h16" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 16V5M7 9l5-5 5 5M4 19h16" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.8-4.8" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 3.5l9 16H3l9-16z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z" />
    </svg>
  );
}

export function IconKey(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L20 3M17 6l2.5 2.5M14.5 8.5l2.5 2.5" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M4 7h16M9 4h6M6 7l1 13h10l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" />
    </svg>
  );
}

export function IconTable(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </svg>
  );
}

export function IconLayoutAuto(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
      <path d="M10 6.5h4M6.5 10v4.5h2M17.5 10v4.5h-2" />
    </svg>
  );
}

export function IconSave(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M5 3h11l4 4v14H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 3v5h8V3M8 21v-6h8v6" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(props)}>
      <path d="M3 3l18 18M10.6 6a9.6 9.6 0 0 1 1.4-.1C18.5 5.9 22 12 22 12a17.6 17.6 0 0 1-3.3 4.3M6.6 6.6C3.9 8.6 2 12 2 12s3.5 6.5 10 6.5c1.5 0 2.9-.3 4.2-.8" />
    </svg>
  );
}

export function DeviceCategoryIcon({
  code,
  className = 'h-5 w-5',
}: {
  code?: string | null;
  className?: string;
}) {
  switch ((code || '').toLowerCase()) {
    case 'router':
      return <IconRouter className={className} />;
    case 'switch':
      return <IconSwitch className={className} />;
    case 'olt':
      return <IconOlt className={className} />;
    case 'ont':
      return <IconOnt className={className} />;
    case 'server':
      return <IconServer className={className} />;
    case 'radio':
      return <IconRadio className={className} />;
    case 'firewall':
      return <IconFirewall className={className} />;
    default:
      return <IconHardwareBox className={className} />;
  }
}
