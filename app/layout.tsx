import type { Metadata, Viewport } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ESG Astraa · HRMS & Attendance",
  description:
    "Internal HRMS & attendance portal for ESG Astraa — attendance, tasks, and team collaboration.",
  manifest: "/manifest.webmanifest",
  applicationName: "ESG Astraa HRMS",
  appleWebApp: {
    capable: true,
    title: "ESG Astraa",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#232234",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={raleway.variable}>
      <body>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
