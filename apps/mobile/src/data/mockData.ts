/**
 * Mock data from Claude Design handoff
 * Based on data.js
 */

import type { Review, AlbumReview, User } from '../lib/types';

export interface Album {
  title: string;
  artist: string;
  year: number;
  kind?: 'playlist' | 'album';
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
  tracks?: Array<{
    n: number;
    name: string;
    reaction: 'flame' | 'love' | 'skip' | null;
    review?: string;
    moments?: Array<{ sec: number; note: string }>;
  }>;
}

export interface FeedReview {
  id: string;
  depth: 'full' | 'caption' | 'floor';
  user: User & { tint: string };
  album: Album;
  rating: number;
  at: string;
  take?: string;
  body?: string | null;
  notes?: Array<{ sec: number; label?: string; note: string }>;
  featured?: number | null;
  likeCount: number;
  repostCount: number;
  saved: boolean;
  via?: User & { tint: string };
}

const USERS = {
  anusha: { id: '1', handle: 'anushaisawesome', displayName: 'Anusha', name: 'Anusha', tint: '#e8a13a', email: '', createdAt: '', updatedAt: '' },
  kelsey: { id: '2', handle: 'kelseyy', displayName: 'Kelsey', name: 'Kelsey', tint: '#3fc8ea', email: '', createdAt: '', updatedAt: '' },
  theo: { id: '3', handle: 'theojpg', displayName: 'Theo', name: 'Theo', tint: '#3ad6a0', email: '', createdAt: '', updatedAt: '' },
};

const ALBUMS: Record<string, Album> = {
  turmeric: {
    title: 'TURMERIC',
    artist: 'The Twins',
    year: 2024,
    palette: { deep: '#23160a', mid: '#7a4a16', lo: '#3a1d0a', accent: '#e8a13a', glow: '#c97a1f' },
    tracks: [
      { n: 1, name: 'Desi Boys', reaction: 'flame', review: 'the thesis statement', moments: [
        { sec: 0, note: 'holy intro, really sets the tone for the rest of the album' },
        { sec: 72, note: 'the dhol comes in and the whole thing levels up' },
      ]},
      { n: 2, name: 'Mango Lassi', reaction: 'love', moments: [] },
      { n: 3, name: "Nani's Kitchen (Interlude)", reaction: 'skip', moments: [] },
      { n: 4, name: 'Saffron', reaction: 'flame', moments: [
        { sec: 168, note: 'this is the one. play it twice.' },
      ]},
      { n: 5, name: 'Twins', reaction: 'love', moments: [] },
    ],
  },
  saw: {
    title: 'Selected Ambient Works',
    artist: 'Aphex Twin',
    year: 1992,
    palette: { deep: '#07140e', mid: '#1c6a4c', lo: '#06231a', accent: '#3ad6a0', glow: '#1f8f68' },
    tracks: [
      { n: 1, name: 'Xtal', reaction: 'flame', moments: [
        { sec: 210, note: 'the pads just breathe here. i had to sit down.' },
      ]},
      { n: 2, name: 'Tha', reaction: 'love', moments: [{ sec: 730, note: 'low end you feel in your teeth' }] },
    ],
  },
  bluerev: {
    title: 'Blue Rev',
    artist: 'Alvvays',
    year: 2022,
    palette: { deep: '#0a1620', mid: '#1f5f80', lo: '#102634', accent: '#6fc6e0', glow: '#3a86b0' },
  },
  language: {
    title: 'Language',
    artist: 'Porter Robinson',
    year: 2014,
    palette: { deep: '#0c1226', mid: '#3a4fb0', lo: '#1a1240', accent: '#8aa6ff', glow: '#5566e0' },
  },
};

export const MOCK_REVIEWS: FeedReview[] = [
  {
    id: 'rv-turmeric',
    depth: 'full',
    user: USERS.anusha,
    album: ALBUMS.turmeric,
    rating: 4.5,
    at: '2026-06-13T08:10:00Z',
    take: 'make some noise for the desi boys!!!!',
    body: 'The desi boys came to play. This is a victory lap of an album - every track struts. The production is glossy but never sterile, and when the dhol kicks in you feel it in your chest.',
    notes: [
      { sec: 0, label: 'holy intro', note: 'holy intro, really sets the tone for the rest of the album' },
      { sec: 72, label: 'the dhol', note: 'the dhol comes in and the whole thing levels up' },
    ],
    featured: 0,
    likeCount: 41,
    repostCount: 9,
    saved: false,
  },
  {
    id: 'rv-bluerev',
    depth: 'caption',
    user: USERS.kelsey,
    album: ALBUMS.bluerev,
    rating: 4.5,
    at: '2026-06-13T07:25:00Z',
    take: 'windows down, august, no notes fr',
    body: null,
    notes: [],
    likeCount: 27,
    repostCount: 6,
    saved: false,
    via: USERS.anusha,
  },
  {
    id: 'rv-saw',
    depth: 'full',
    user: USERS.theo,
    album: ALBUMS.saw,
    rating: 5.0,
    at: '2026-06-12T23:05:00Z',
    take: 'i put this on to fall asleep and stayed awake for all of it',
    body: 'Thirty years old and still from the future. SAW is less an album than a room you walk into - the synths don\'t play melodies so much as weather.',
    notes: [
      { sec: 210, label: 'xtal', note: 'the pads just breathe here. i had to sit down.' },
      { sec: 730, label: 'tha', note: 'low end you feel in your teeth' },
    ],
    featured: 0,
    likeCount: 63,
    repostCount: 21,
    saved: false,
  },
  {
    id: 'rv-language',
    depth: 'floor',
    user: USERS.theo,
    album: ALBUMS.language,
    rating: 5.0,
    at: '2026-06-12T20:10:00Z',
    likeCount: 18,
    repostCount: 4,
    saved: false,
  },
];

export const MOCK_PROFILE = {
  user: USERS.anusha,
  bio: 'diary of the felt · currently: turmeric on repeat',
  favourites: {
    tracks: [],
    albums: [],
  },
  thisWeek: {
    tracks: [],
    lastUpdated: new Date().toISOString(),
  },
};
