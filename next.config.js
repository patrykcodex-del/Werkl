module.exports = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Google
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // GitHub
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Discord
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      // Twitter / X
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      // Microsoft
      { protocol: 'https', hostname: 'graph.microsoft.com' },
      // Apple (no avatar URL, included for completeness)
      // LinkedIn
      { protocol: 'https', hostname: 'media.licdn.com' },
    ],
  },
};