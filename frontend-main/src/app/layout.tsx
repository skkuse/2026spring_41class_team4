import type { Metadata } from "next";
import "./globals.css";
import { GoogleAuthProvider } from "../components/GoogleAuthProvider";

import { ToastProvider } from "../contexts/ToastContext";

export const metadata: Metadata = {
  title: "SudoCampus",
  description: "Sudo Your Campus Life",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GoogleAuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
