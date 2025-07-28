const dotenv = require('dotenv');
dotenv.config();
const fetch = require('node-fetch').default;
const fs = require('fs');
const bandcamp = require('@alexjorgef/bandcamp-scraper');
const path = require('path');

// If you are using this script as your main updater, you can delete the old bandcamp and spotify scripts.

const BANDCAMP_URL = 'https://kaifathers.bandcamp.com/';

function parseDuration(duration) {
  // Accepts 'mm:ss' or 'm:ss' or 'ss' or 'N/A', returns seconds
  if (!duration || duration === 'N/A') return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function determineType(trackCount, totalSeconds) {
  if (trackCount <= 3) return 'single';
  if (trackCount >= 4 && trackCount <= 6 && totalSeconds <= 30 * 60) return 'ep';
  return 'album';
}

function minifyRelease({ title, cover_url, tracks, track_lengths, spotify_url, bandcamp_url, type, description, release_date, embed }) {
  // Calculate type if not set
  const trackObjs = tracks.map((t, i) => ({ title: t, length: track_lengths[i] }));
  const trackCount = trackObjs.length;
  const totalSeconds = trackObjs.reduce((sum, t) => sum + parseDuration(t.length), 0);
  let finalType = type;
  if (!finalType || finalType === 'unknown') {
    finalType = determineType(trackCount, totalSeconds);
  }
  return {
    title,
    cover_url,
    tracks: trackObjs,
    spotify_url: spotify_url || 'N/A',
    bandcamp_url: bandcamp_url || 'N/A',
    type: finalType,
    description: description || '',
    release_date: release_date || '',
    embed: embed || ''
  };
}

function fetchBandcampReleases(callback) {
  bandcamp.getAlbumUrls(BANDCAMP_URL, (err, albumUrls) => {
    if (err) {
      console.error('Error fetching album URLs:', err);
      callback([]);
      return;
    }
    const allAlbums = [];
    const rawAlbums = [];
    let completed = 0;
    if (albumUrls.length === 0) {
      callback([]);
      return;
    }
    albumUrls.forEach(albumUrl => {
      bandcamp.getAlbumInfo(albumUrl, (err, albumInfo) => {
        completed++;
        if (err) {
          console.error('Error fetching album info:', err);
        } else {
          rawAlbums.push(albumInfo); // Save raw for debugging
          let tracks = [];
          let track_lengths = [];
          if (Array.isArray(albumInfo.trackInfo) && albumInfo.trackInfo.length > 0) {
            tracks = albumInfo.trackInfo.map(t => t.title || t.name);
            track_lengths = albumInfo.trackInfo.map(t => t.duration);
          } else if (Array.isArray(albumInfo.tracks) && albumInfo.tracks.length > 0) {
            tracks = albumInfo.tracks.map(t => t.title || t.name);
            track_lengths = albumInfo.tracks.map(t => t.duration);
          }
          let description = albumInfo.about || (albumInfo.raw && albumInfo.raw.current && albumInfo.raw.current.about) || '';
          let embed = '';
          let trackId = null;
          const albumId = albumInfo.raw && albumInfo.raw.current && albumInfo.raw.current.id;
          if (albumInfo.raw && albumInfo.raw.current) {
            if (albumInfo.raw.current.featured_track_id) {
              trackId = albumInfo.raw.current.featured_track_id;
            } else if (Array.isArray(albumInfo.raw.current.trackinfo) && albumInfo.raw.current.trackinfo.length > 0 && albumInfo.raw.current.trackinfo[0].id) {
              trackId = albumInfo.raw.current.trackinfo[0].id;
            }
          }
          if (trackId && albumInfo.url && tracks.length === 1) {
            // Single: use track embed
            embed = `<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/track=${trackId}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/" seamless><a href="${albumInfo.url}">${albumInfo.title} by Kai Fathers</a></iframe>`;
            console.log('Single embed generated for:', albumInfo.title, 'trackId:', trackId);
          } else if (albumId && trackId && albumInfo.url && tracks.length > 1) {
            // Album: use album embed with track (only for multi-track releases)
            embed = `<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/track=${trackId}/transparent=true/" seamless><a href="${albumInfo.url}">${albumInfo.title} by Kai Fathers</a></iframe>`;
            console.log('Album embed with track generated for:', albumInfo.title, 'albumId:', albumId, 'trackId:', trackId);
          } else if (albumId && albumInfo.url && tracks.length > 1) {
            // fallback: album embed without track (only for multi-track releases)
            embed = `<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/" seamless><a href="${albumInfo.url}">${albumInfo.title} by Kai Fathers</a></iframe>`;
            console.log('Album embed without track generated for:', albumInfo.title, 'albumId:', albumId);
          } else {
            console.log('No Bandcamp embed generated for:', albumInfo.title, 'trackId:', trackId, 'albumId:', albumId, 'tracks.length:', tracks.length);
          }
          let release_date = '';
          if (albumInfo.raw && albumInfo.raw.current && albumInfo.raw.current.release_date) {
            release_date = albumInfo.raw.current.release_date;
          }
          allAlbums.push({
            title: albumInfo.title,
            cover_url: albumInfo.imageUrl,
            tracks,
            track_lengths,
            bandcamp_url: albumInfo.url,
            spotify_url: undefined, // will be filled in merge step if available
            type: undefined, // will be filled in merge step if available
            description,
            embed,
            release_date
          });
        }
        if (completed === albumUrls.length) {
          callback(allAlbums);
        }
      });
    });
  });
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ARTIST_ID = '7aOzfiyPyb1w6s6If52cpg';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function slugifyForFile(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function parseFormattedReleases(text) {
  const releases = [];
  const blocks = text.split(/^-{5,}$/m);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines[0] || !lines[0].startsWith('ALBUM:')) continue;
    const title = lines[0].replace('ALBUM: ', '').trim();
    const cover_url = lines[1]?.replace('Cover: ', '').trim();
    const spotify_url = lines[2]?.replace('Spotify: ', '').trim();
    const bandcamp_url = lines[3]?.replace('Bandcamp: ', '').trim();
    const tracks = [];
    let i = 5;
    while (i < lines.length && lines[i].startsWith('  - ')) {
      const match = lines[i].match(/^  - (.*) \[(.*)\]$/);
      if (match) {
        tracks.push({ title: match[1], length: match[2] });
      }
      i++;
    }
    // Type and description will be filled in merge step
    releases.push({ title, cover_url, spotify_url, bandcamp_url, tracks, type: undefined, description: '' });
  }
  return releases;
}

function fillTemplate(template, data) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (m, key) => data[key] || '');
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  // Handles both ISO and Bandcamp date formats
  // For Bandcamp: '24 Jul 2025 18:00:30 GMT' -> '24 Jul 2025'
  // For ISO: '2024-07-30' -> '2024-07-30'
  if (dateStr.includes('GMT')) {
    return dateStr.split(' ').slice(0, 3).join(' ');
  }
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr.split(' ')[0];
}

function generateReleasePages(releases) {
  const albumTemplate = fs.readFileSync(path.join(__dirname, '../templates/album_template.html'), 'utf8');
  const singleTemplate = fs.readFileSync(path.join(__dirname, '../templates/single_template.html'), 'utf8');
  for (const rel of releases) {
    const slug = slugifyForFile(rel.title);
    const isAlbum = rel.tracks.length > 3;
    const outDir = isAlbum ? path.join(__dirname, '../releases/lp-ep') : path.join(__dirname, '../releases/singles');
    const outFile = path.join(outDir, `${slug}.html`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const template = isAlbum ? albumTemplate : singleTemplate;
    const tracksHtml = rel.tracks.map((t, i) => `
      <li class="tracklist-item">
        <span class="track-number">${i + 1}.</span>
        <span class="track-title">${t.title}</span>
        <span class="track-length">${t.length}</span>
      </li>`).join('');
    // Prioritize Bandcamp embed if it exists, otherwise use Spotify embed if it exists
    let embed = '';
    if (rel.embed && rel.embed.trim()) {
      embed = rel.embed; // Bandcamp
      console.log('Using Bandcamp embed for:', rel.title);
    } else if (rel.spotify_url && rel.spotify_url !== 'N/A') {
      const match = rel.spotify_url.match(/album\/([a-zA-Z0-9]+)/);
      if (match) {
        const spotifyId = match[1];
        embed = `<iframe style=\"border-radius:12px\" src=\"https://open.spotify.com/embed/album/${spotifyId}?utm_source=generator\" width=\"100%\" height=\"152\" frameBorder=\"0\" allowfullscreen=\"\" allow=\"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture\" loading=\"lazy\"></iframe>`;
        console.log('Using Spotify embed for:', rel.title, 'Bandcamp embed was empty');
      }
    } else {
      console.log('No embed available for:', rel.title, 'Bandcamp embed:', rel.embed ? 'exists' : 'empty', 'Spotify URL:', rel.spotify_url);
    }
    // Title image/text logic: output a single title_html variable
    const titleImgPath = path.join(__dirname, `../assets/img/titles/${slug}.png`);
    let title_html = '';
    if (fs.existsSync(titleImgPath)) {
      title_html = `<img src=\"/assets/img/titles/${slug}.png\" alt=\"${rel.title}\" style=\"max-width:90%;height:auto;filter:invert(1);display:inline-block;\">`;
    } else {
      title_html = `<span style=\"color:#fff;\">${rel.title}</span>`;
    }
    const html = fillTemplate(template, {
      title_html,
      cover_url: rel.cover_url,
      spotify_url: rel.spotify_url,
      bandcamp_url: rel.bandcamp_url,
      tracks: tracksHtml,
      type: rel.type,
      description: rel.description,
      embed: embed,
      release_date: formatDateOnly(rel.release_date)
    });
    fs.writeFileSync(outFile, html);
  }
  console.log('Generating release pages for', releases.length, 'releases');
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
  const url = `https://api.spotify.com/v1/artists/${SPOTIFY_ARTIST_ID}/albums?include_groups=album,single,ep&limit=50`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  const releases = [];
  for (const item of data.items) {
    const tracksResp = await fetch(`https://api.spotify.com/v1/albums/${item.id}/tracks`, { headers });
    const tracksData = await tracksResp.json();
    releases.push({
      title: item.name,
      cover_url: item.images[0]?.url || '',
      tracks: tracksData.items.map(t => t.name),
      track_lengths: tracksData.items.map(t => t.duration_ms ? `${Math.floor(t.duration_ms/60000)}:${String(Math.floor((t.duration_ms%60000)/1000)).padStart(2, '0')}` : 'N/A'),
      spotify_url: item.external_urls.spotify,
      bandcamp_url: undefined, // will be filled in merge step if available
      type: item.album_type, // 'album', 'single', or 'ep'
      release_date: item.release_date // ISO date string
    });
  }
  return releases;
}

function deduplicateAndMergeReleases(spotify, bandcamp) {
  const map = new Map();
  for (const rel of spotify) {
    const key = rel.title.trim().toLowerCase();
    map.set(key, { ...rel });
  }
  for (const rel of bandcamp) {
    const key = rel.title.trim().toLowerCase();
    if (map.has(key)) {
      const merged = map.get(key);
      merged.bandcamp_url = rel.bandcamp_url || merged.bandcamp_url || 'N/A';
      merged.cover_url = merged.cover_url || rel.cover_url;
      merged.tracks = merged.tracks.length ? merged.tracks : rel.tracks;
      merged.track_lengths = merged.track_lengths.length ? merged.track_lengths : rel.track_lengths;
      merged.type = merged.type || rel.type || 'unknown';
      merged.description = merged.description || rel.description || '';
      merged.embed = rel.embed || merged.embed || '';
      merged.release_date = (merged.release_date && merged.release_date !== '') ? merged.release_date : (rel.release_date || '');
      map.set(key, merged);
    } else {
      map.set(key, { ...rel });
    }
  }
  return Array.from(map.values()).map(minifyRelease);
}

function formatReleaseText(release) {
  let out = `ALBUM: ${release.title}\n`;
  out += `Cover: ${release.cover_url}\n`;
  out += `Spotify: ${release.spotify_url}\n`;
  out += `Bandcamp: ${release.bandcamp_url}\n`;
  out += `Release Date: ${formatDateOnly(release.release_date)}\n`;
  out += `Tracks:`;
  if (release.tracks && release.tracks.length) {
    for (const t of release.tracks) {
      out += `\n  - ${t.title} [${t.length}]`;
    }
  } else {
    out += ' N/A';
  }
  out += '\n';
  return out;
}

// Place updateDiscographyHtml here so it is defined before main()
function updateDiscographyHtml(releases) {
  const discogPath = path.join(__dirname, '../discography.html');
  let discogHtml = fs.readFileSync(discogPath, 'utf8');
  const start = discogHtml.indexOf('<!-- DISC_START -->');
  const end = discogHtml.indexOf('<!-- DISC_END -->');
  if (start === -1 || end === -1) {
    return;
  }
  const before = discogHtml.slice(0, start + '<!-- DISC_START -->'.length);
  const after = discogHtml.slice(end);
  const sorted = releases.slice().sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date) : new Date(0);
    const dateB = b.release_date ? new Date(b.release_date) : new Date(0);
    return dateB - dateA;
  });
  const gallery = sorted.map(rel => {
    const slug = slugifyForFile(rel.title);
    const isAlbum = rel.tracks.length > 3;
    const link = isAlbum ? `/releases/lp-ep/${slug}.html` : `/releases/singles/${slug}.html`;
    // Use PNG title image if it exists
    const titleImgPath = path.join(__dirname, `../assets/img/titles/${slug}.png`);
    let titleHtml;
    if (fs.existsSync(titleImgPath)) {
      titleHtml = `<img src="/assets/img/titles/${slug}.png" alt="${rel.title} Title" style="max-width:100%;height:auto;">`;
    } else {
      titleHtml = rel.title;
    }
    return `<div class=\"gallery-item\"><a href=\"${link}\">\n      <div class=\"img-container\"><img src=\"${rel.cover_url}\" alt=\"${rel.title} Cover\"></div>\n      <p class=\"album-title\">${titleHtml}</p>\n    </a></div>`;
  }).join('\n');
  const newHtml = before + '\n' + gallery + '\n' + after;
  try {
    fs.writeFileSync(discogPath, newHtml);
  } catch (err) {
    console.error('Error writing to discography.html:', err);
  }
}

async function main() {
  const spotifyReleases = await fetchSpotifyReleases();
  fetchBandcampReleases(bandcampReleases => {
    const allReleases = deduplicateAndMergeReleases(spotifyReleases, bandcampReleases);
    const formatted = allReleases.map(formatReleaseText).join('\n-----------------------------\n');
    fs.writeFileSync('releases.txt', formatted);
    generateReleasePages(allReleases);
    updateDiscographyHtml(allReleases);
  });
}

main();