import "./globals.css";

export const metadata = { title: "MountainHarmony — Perjalanan yang menumbuhkan", description: "Ekowisata yang menghubungkan alam, pendidikan, dan ibu lokal." };

export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}