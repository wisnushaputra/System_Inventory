import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Passnet Inventory Sistem",
    template: "%s | Passnet Inventory Sistem",
  },
  description:
    "Passnet Inventory Sistem - Manajemen inventaris perangkat jaringan, alamat IP, topologi relasi, dan jejak audit operasional.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/icon.png",
  },
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('nims-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full bg-canvas text-ink font-sans antialiased">
        <ThemeProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
