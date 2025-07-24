import os
import re
from jinja2 import Environment, FileSystemLoader
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# Load environment variables from .env
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_ARTIST_ID = '7aOzfiyPyb1w6s6If52cpg'  # Replace with your actual artist ID
BANDCAMP_URL = 'https://kaifathers.bandcamp.com'  # Replace with your Bandcamp URL

NORMALIZE_REMOVE = ['demo', 'remaster', 'version', 'ep', 'single']

def slugify(value):
    value = value.lower()
    value = re.sub(r'[^a-z0-9\s-]', '', value)
    value = re.sub(r'\s+', '-', value)
    value = re.sub(r'-+', '-', value)
    return value.strip('-')

def normalize_title(title):
    title = title.lower()
    for word in NORMALIZE_REMOVE:
        title = title.replace(word, '')
    title = re.sub(r'[^a-z0-9\s-]', '', title)
    title = re.sub(r'\s+', ' ', title)
    return title.strip()

def normalize_tracklist(tracks):
    return [normalize_title(t) for t in tracks]

# Bandcamp scraping (basic, public releases only)
def fetch_bandcamp_releases():
    releases = []
    resp = requests.get(BANDCAMP_URL)
    soup = BeautifulSoup(resp.text, 'html.parser')
    # Find all album links
    album_links = soup.select('a[href*="/album/"]')
    seen = set()
    for a in album_links:
        href = a['href']
        if href in seen:
            continue
        seen.add(href)
        album_url = href if href.startswith('http') else BANDCAMP_URL + href
        album_resp = requests.get(album_url)
        album_soup = BeautifulSoup(album_resp.text, 'html.parser')
        title = album_soup.find('h2', class_='trackTitle').text.strip()
        # Try to get release date
        date_tag = album_soup.find('meta', {'itemprop': 'datePublished'})
        release_date = date_tag['content'] if date_tag else ''
        # Get tracklist
        tracks = [t.text.strip() for t in album_soup.select('.track_list .track-title')]
        # Get cover art
        img_tag = album_soup.find('a', class_='popupImage')
        cover_url = img_tag['href'] if img_tag else ''
        # Determine type
        release_type = 'album' if len(tracks) > 1 else 'single'
        releases.append({
            'type': release_type,
            'title': title,
            'slug': slugify(title),
            'cover_url': cover_url,
            'tracks': tracks,
            'description': '',
            'bandcamp_url': album_url,
            'release_date': release_date,
        })
    return releases

def releases_are_same(r1, r2):
    # Compare type
    if r1['type'] != r2['type']:
        return False
    # Compare normalized titles
    t1 = normalize_title(r1['title'])
    t2 = normalize_title(r2['title'])
    if t1 == t2:
        # Compare tracklists
        tr1 = normalize_tracklist(r1['tracks'])
        tr2 = normalize_tracklist(r2['tracks'])
        if tr1 == tr2:
            return True
        # Fallback: if both are singles and main track matches
        if r1['type'] == 'single' and tr1 and tr2 and tr1[0] == tr2[0]:
            return True
        # Fallback: if release dates are close and tracklists are similar
        if r1.get('release_date') and r2.get('release_date'):
            try:
                d1 = datetime.strptime(r1['release_date'][:10], '%Y-%m-%d')
                d2 = datetime.strptime(r2['release_date'][:10], '%Y-%m-%d')
                if abs((d1 - d2).days) <= 7 and len(tr1) == len(tr2):
                    return True
            except Exception:
                pass
    return False

def get_spotify_access_token():
    url = 'https://accounts.spotify.com/api/token'
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    data = {'grant_type': 'client_credentials'}
    response = requests.post(url, headers=headers, data=data, auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET))
    response.raise_for_status()
    return response.json()['access_token']

def fetch_spotify_releases():
    access_token = get_spotify_access_token()
    headers = {'Authorization': f'Bearer {access_token}'}
    albums_url = f'https://api.spotify.com/v1/artists/{SPOTIFY_ARTIST_ID}/albums?include_groups=album,single,ep&limit=50'
    response = requests.get(albums_url, headers=headers)
    response.raise_for_status()
    items = response.json().get('items', [])
    releases = []
    for item in items:
        # Determine type for filename
        album_type = item.get('album_type', 'album')
        if album_type == 'single':
            release_type = 'single'
        elif album_type == 'album':
            release_type = 'album'
        elif album_type == 'ep':
            release_type = 'ep'
        else:
            release_type = album_type
        release = {
            'type': release_type,
            'title': item['name'],
            'slug': slugify(item['name']),
            'cover_url': item['images'][0]['url'] if item['images'] else '',
            'tracks': [],  # Will fetch below
            'description': '',  # Spotify does not provide description
            'spotify_url': item['external_urls']['spotify'],
            'id': item['id'],
        }
        # Fetch tracklist
        tracks_url = f"https://api.spotify.com/v1/albums/{item['id']}/tracks"
        tracks_resp = requests.get(tracks_url, headers=headers)
        tracks_resp.raise_for_status()
        tracks = tracks_resp.json().get('items', [])
        release['tracks'] = [track['name'] for track in tracks]
        releases.append(release)
    return releases

def main():
    spotify_releases = fetch_spotify_releases()
    bandcamp_releases = fetch_bandcamp_releases()
    # Deduplicate: Only add Bandcamp releases that are not in Spotify
    all_releases = spotify_releases.copy()
    for bc in bandcamp_releases:
        found = False
        for sp in spotify_releases:
            if releases_are_same(bc, sp):
                found = True
                break
        if not found:
            all_releases.append(bc)
    # Instead of generating HTML, write all unique releases to releases.txt
    with open('releases.txt', 'w', encoding='utf-8') as f:
        for release in all_releases:
            f.write(f"{release['type'].upper()}: {release['title']}\n")
            f.write(f"  Tracks: {', '.join(release['tracks'])}\n")
            if 'spotify_url' in release:
                f.write(f"  Spotify: {release['spotify_url']}\n")
            if 'bandcamp_url' in release:
                f.write(f"  Bandcamp: {release['bandcamp_url']}\n")
            f.write('\n')
    print('Wrote all unique releases to releases.txt.')

if __name__ == '__main__':
    main() 