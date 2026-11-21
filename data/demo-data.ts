export type Player = {
  slug: string;
  name: string;
  initials: string;
  color: string;
  games: number;
  wins: number;
  winRate: number;
  favoriteDeck: string;
  streak: number;
};

export const players: Player[] = [
  { slug: "rowan-lee", name: "Will", initials: "WI", color: "#7c6ee6", games: 42, wins: 15, winRate: 35.7, favoriteDeck: "Muldrotha, the Gravetide", streak: 3 },
  { slug: "morgan-chen", name: "Manfred", initials: "MA", color: "#de8b5a", games: 39, wins: 13, winRate: 33.3, favoriteDeck: "Niv-Mizzet, Parun", streak: 1 },
  { slug: "alex-rivera", name: "Josh", initials: "JO", color: "#4d9d8c", games: 36, wins: 11, winRate: 30.6, favoriteDeck: "Isshin, Two Heavens as One", streak: 0 },
  { slug: "jamie-park", name: "Nelson", initials: "NE", color: "#5984c5", games: 34, wins: 9, winRate: 26.5, favoriteDeck: "Teysa Karlov", streak: 2 },
  { slug: "sam-patel", name: "Sam", initials: "SA", color: "#bf6680", games: 31, wins: 7, winRate: 22.6, favoriteDeck: "Gishath, Sun’s Avatar", streak: 0 },
  { slug: "taylor-brooks", name: "Keenan", initials: "KE", color: "#ba9b48", games: 28, wins: 6, winRate: 21.4, favoriteDeck: "Aesi, Tyrant of Gyre Strait", streak: 1 },
];

export const decks = [
  { name: "Muldrotha, the Gravetide", pilot: "Will", colors: "Sultai", games: 24, wins: 10, winRate: 41.7, tone: "violet" },
  { name: "Niv-Mizzet, Parun", pilot: "Manfred", colors: "Izzet", games: 21, wins: 8, winRate: 38.1, tone: "blue" },
  { name: "Isshin, Two Heavens as One", pilot: "Josh", colors: "Mardu", games: 19, wins: 7, winRate: 36.8, tone: "rose" },
  { name: "Teysa Karlov", pilot: "Nelson", colors: "Orzhov", games: 18, wins: 5, winRate: 27.8, tone: "slate" },
  { name: "Gishath, Sun’s Avatar", pilot: "Sam", colors: "Naya", games: 16, wins: 4, winRate: 25.0, tone: "amber" },
  { name: "Aesi, Tyrant of Gyre Strait", pilot: "Keenan", colors: "Simic", games: 14, wins: 3, winRate: 21.4, tone: "teal" },
];

export const recentGames = [
  { date: "Nov 18, 2026", title: "Wednesday Commander", players: ["WI", "MA", "JO", "NE"], winner: "Will", deck: "Muldrotha, the Gravetide", duration: "1h 42m" },
  { date: "Nov 15, 2026", title: "Sunday League · Round 4", players: ["MA", "JO", "SA", "KE"], winner: "Manfred", deck: "Niv-Mizzet, Parun", duration: "58m" },
  { date: "Nov 12, 2026", title: "Wednesday Commander", players: ["WI", "NE", "SA", "KE"], winner: "Nelson", deck: "Teysa Karlov", duration: "1h 26m" },
  { date: "Nov 09, 2026", title: "Sunday League · Round 3", players: ["WI", "MA", "JO", "SA"], winner: "Josh", deck: "Isshin, Two Heavens as One", duration: "1h 11m" },
  { date: "Nov 05, 2026", title: "Wednesday Commander", players: ["MA", "JO", "NE", "KE"], winner: "Manfred", deck: "Niv-Mizzet, Parun", duration: "1h 34m" },
];

export const monthlyGames = [14, 19, 16, 23, 20, 27, 22, 31, 24, 29, 35, 32];
export const monthlyLabels = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

export const insights = [
  { eyebrow: "MOST CONSISTENT", title: "Will is on a 3-game win streak", detail: "Muldrotha has taken the last three games Will played.", icon: "↗", tone: "violet" },
  { eyebrow: "TABLE TALK", title: "Long games favor the blue decks", detail: "Games over 90 minutes have a 1.8× higher Izzet win rate.", icon: "◷", tone: "blue" },
  { eyebrow: "NEW RECORD", title: "October was your biggest month", detail: "35 games played, up 21% from September.", icon: "✳", tone: "amber" },
];
