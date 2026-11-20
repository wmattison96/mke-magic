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
  { slug: "rowan-lee", name: "Rowan Lee", initials: "RL", color: "#7c6ee6", games: 42, wins: 15, winRate: 35.7, favoriteDeck: "Muldrotha, the Gravetide", streak: 3 },
  { slug: "morgan-chen", name: "Morgan Chen", initials: "MC", color: "#de8b5a", games: 39, wins: 13, winRate: 33.3, favoriteDeck: "Niv-Mizzet, Parun", streak: 1 },
  { slug: "alex-rivera", name: "Alex Rivera", initials: "AR", color: "#4d9d8c", games: 36, wins: 11, winRate: 30.6, favoriteDeck: "Isshin, Two Heavens as One", streak: 0 },
  { slug: "jamie-park", name: "Jamie Park", initials: "JP", color: "#5984c5", games: 34, wins: 9, winRate: 26.5, favoriteDeck: "Teysa Karlov", streak: 2 },
  { slug: "sam-patel", name: "Sam Patel", initials: "SP", color: "#bf6680", games: 31, wins: 7, winRate: 22.6, favoriteDeck: "Gishath, Sun’s Avatar", streak: 0 },
  { slug: "taylor-brooks", name: "Taylor Brooks", initials: "TB", color: "#ba9b48", games: 28, wins: 6, winRate: 21.4, favoriteDeck: "Aesi, Tyrant of Gyre Strait", streak: 1 },
];

export const decks = [
  { name: "Muldrotha, the Gravetide", pilot: "Rowan Lee", colors: "Sultai", games: 24, wins: 10, winRate: 41.7, tone: "violet" },
  { name: "Niv-Mizzet, Parun", pilot: "Morgan Chen", colors: "Izzet", games: 21, wins: 8, winRate: 38.1, tone: "blue" },
  { name: "Isshin, Two Heavens as One", pilot: "Alex Rivera", colors: "Mardu", games: 19, wins: 7, winRate: 36.8, tone: "rose" },
  { name: "Teysa Karlov", pilot: "Jamie Park", colors: "Orzhov", games: 18, wins: 5, winRate: 27.8, tone: "slate" },
  { name: "Gishath, Sun’s Avatar", pilot: "Sam Patel", colors: "Naya", games: 16, wins: 4, winRate: 25.0, tone: "amber" },
  { name: "Aesi, Tyrant of Gyre Strait", pilot: "Taylor Brooks", colors: "Simic", games: 14, wins: 3, winRate: 21.4, tone: "teal" },
];

export const recentGames = [
  { date: "Nov 18, 2026", title: "Wednesday Commander", players: ["RL", "MC", "AR", "JP"], winner: "Rowan Lee", deck: "Muldrotha, the Gravetide", duration: "1h 42m" },
  { date: "Nov 15, 2026", title: "Sunday League · Round 4", players: ["MC", "AR", "SP", "TB"], winner: "Morgan Chen", deck: "Niv-Mizzet, Parun", duration: "58m" },
  { date: "Nov 12, 2026", title: "Wednesday Commander", players: ["RL", "JP", "SP", "TB"], winner: "Jamie Park", deck: "Teysa Karlov", duration: "1h 26m" },
  { date: "Nov 09, 2026", title: "Sunday League · Round 3", players: ["RL", "MC", "AR", "SP"], winner: "Alex Rivera", deck: "Isshin, Two Heavens as One", duration: "1h 11m" },
  { date: "Nov 05, 2026", title: "Wednesday Commander", players: ["MC", "AR", "JP", "TB"], winner: "Morgan Chen", deck: "Niv-Mizzet, Parun", duration: "1h 34m" },
];

export const monthlyGames = [14, 19, 16, 23, 20, 27, 22, 31, 24, 29, 35, 32];
export const monthlyLabels = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

export const insights = [
  { eyebrow: "MOST CONSISTENT", title: "Rowan is on a 3-game win streak", detail: "Muldrotha has taken the last three games Rowan played.", icon: "↗", tone: "violet" },
  { eyebrow: "TABLE TALK", title: "Long games favor the blue decks", detail: "Games over 90 minutes have a 1.8× higher Izzet win rate.", icon: "◷", tone: "blue" },
  { eyebrow: "NEW RECORD", title: "October was your biggest month", detail: "35 games played, up 21% from September.", icon: "✳", tone: "amber" },
];
