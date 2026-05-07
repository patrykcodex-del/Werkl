import React from 'react';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SessionProvider from '../components/SessionProvider';
import { ThemeProvider } from '../components/ThemeProvider';

export const metadata = {
    title: 'Werkl.ai',
    description: 'Connecting humans with tasks that AI cannot complete.',
};

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="min-h-screen flex flex-col antialiased" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <ThemeProvider>
                    <SessionProvider>
                        <Navbar />
                        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pt-22">
                            {children}
                        </main>
                        <Footer />
                    </SessionProvider>
                </ThemeProvider>
            </body>
        </html>
    );
};

export default Layout;