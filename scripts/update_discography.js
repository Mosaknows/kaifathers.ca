import dotenv from 'dotenv';
dotenv.config();
import bcfetch from 'bandcamp-fetch';
import fetch from 'node-fetch';
import fs from 'fs';

const BANDCAMP_URL = 'https://kaifathers.bandcamp.com';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ARTIST_ID = '7aOzfiyPyb1w6s6If52cpg';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function fetchBandcampReleases() {
  const discog = await bcfetch.band.getDiscography({ bandUrl: BANDCAMP_URL });
  const releases = [];
  for (const item of discog) {
    let info;
    if (item.type === 'album') {
      info = await bcfetch.album.getInfo({ albumUrl: item.url });
      if (!info.title) continue;
      releases.push({
        type: info.tracks && info.tracks.length > 1 ? 'album' : 'single',
        title: info.title,
        slug: slugify(info.title),
        cover_url: info.imageUrl,
        tracks: info.tracks ? info.tracks.map(t => t.title) : [],
        track_lengths: info.tracks ? info.tracks.map(t => t.duration ? `${Math.floor(t.duration/60)}:${String(Math.floor(t.duration%60)).padStart(2, '0')}` : 'N/A') : [],
        bandcamp_url: info.url,
        release_date: info.releaseDate,
      });
    } else if (item.type === 'track') {
      info = await bcfetch.track.getInfo({ trackUrl: item.url });
      if (!info.title) continue;
      releases.push({
        type: 'single',
        title: info.title,
        slug: slugify(info.title),
        cover_url: info.imageUrl,
        tracks: [info.title],
        track_lengths: [info.duration ? `${Math.floor(info.duration/60)}:${String(Math.floor(info.duration%60)).padStart(2, '0')}` : 'N/A'],
        bandcamp_url: info.url,
        release_date: info.releaseDate,
      });
    }
  }
  return releases;
}

async function getSpotifyAccessToken() {
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${SPOTIFY_CLIENT_ID}&client_secret=${SPOTIFY_CLIENT_SECRET}`
  });
  const data = await resp.json();
  return data.access_token;
}

async function fetchSpotifyReleases() {
  const accessToken = await getSpotifyAccessToken();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const url = `https://api.spotify.com/v1/artists/${SPOTIFY_ARTIST_ID}/albums?include_groups=album,single&limit=50`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  const releases = [];
  for (const item of data.items) {
    const tracksResp = await fetch(`https://api.spotify.com/v1/albums/${item.id}/tracks`, { headers });
    const tracksData = await tracksResp.json();
    releases.push({
      type: item.album_type === 'album' ? 'album' : 'single',
      title: item.name,
      slug: slugify(item.name),
      cover_url: item.images[0]?.url || '',
      tracks: tracksData.items.map(t => t.name),
      track_lengths: tracksData.items.map(t => t.duration_ms ? `${Math.floor(t.duration_ms/60000)}:${String(Math.floor((t.duration_ms%60000)/1000)).padStart(2, '0')}` : 'N/A'),
      spotify_url: item.external_urls.spotify,
      release_date: item.release_date,
    });
  }
  return releases;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/demo|remaster|version|ep|single/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeTracklist(tracks) {
  return tracks.map(normalizeTitle);
}

function releasesAreSame(r1, r2) {
  if (r1.type !== r2.type) return false;
  const t1 = normalizeTitle(r1.title);
  const t2 = normalizeTitle(r2.title);
  if (t1 === t2) {
    const tr1 = normalizeTracklist(r1.tracks);
    const tr2 = normalizeTracklist(r2.tracks);
    if (JSON.stringify(tr1) === JSON.stringify(tr2)) return true;
    if (r1.type === 'single' && tr1[0] === tr2[0]) return true;
    if (r1.release_date && r2.release_date) {
      const d1 = new Date(r1.release_date);
      const d2 = new Date(r2.release_date);
      if (Math.abs(d1 - d2) / (1000 * 60 * 60 * 24) <= 7 && tr1.length === tr2.length) return true;
    }
  }
  return false;
}

async function main() {
  const [spotifyReleases, bandcampReleases] = await Promise.all([
    fetchSpotifyReleases(),
    fetchBandcampReleases()
  ]);

  // Write separate files for debugging
  fs.writeFileSync('releases_spotify.txt', spotifyReleases.map(r => `${r.type.toUpperCase()}: ${r.title}\n  Tracks:\n${r.tracks.map((t,i) => `    - ${t} [${r.track_lengths[i]}]`).join('\n')}\n  Spotify: ${r.spotify_url || ''}\n`).join('\n\n'));
  fs.writeFileSync('releases_bandcamp.txt', bandcampReleases.map(r => `${r.type.toUpperCase()}: ${r.title}\n  Tracks:\n${r.tracks.map((t,i) => `    - ${t} [${r.track_lengths[i]}]`).join('\n')}\n  Bandcamp: ${r.bandcamp_url || ''}\n`).join('\n\n'));

  // Deduplicate
  const allReleases = [...spotifyReleases];
  for (const bc of bandcampReleases) {
    if (!spotifyReleases.some(sp => releasesAreSame(bc, sp))) {
      allReleases.push(bc);
    }
  }
  fs.writeFileSync('releases.txt', allReleases.map(r => `${r.type.toUpperCase()}: ${r.title}\n  Tracks:\n${r.tracks.map((t,i) => `    - ${t} [${r.track_lengths[i]}]`).join('\n')}\n  Spotify: ${r.spotify_url || ''}\n  Bandcamp: ${r.bandcamp_url || ''}\n`).join('\n\n'));
}

main(); 