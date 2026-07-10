import "./globals.css";

export const metadata = {
  title: "PortableBrain",
  description: "One persistent memory that follows you into every AI chat.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
