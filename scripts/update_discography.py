import os
import re
from jinja2 import Environment, FileSystemLoader
from dotenv import load_dotenv
import requests

# Load environment variables from .env
load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_ARTIST_ID = '7aOzfiyPyb1w6s6If52cpg'  # Replace with your actual artist ID

def slugify(value):
    value = value.lower()
    value = re.sub(r'[^a-z0-9\s-]', '', value)
    value = re.sub(r'\s+', '-', value)
    value = re.sub(r'-+', '-', value)
    return value.strip('-')

# Placeholder for Bandcamp data fetching (to be implemented)
def fetch_bandcamp_releases():
    # TODO: Implement actual Bandcamp scraping or API fetching
    return []

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
    releases = fetch_bandcamp_releases() + fetch_spotify_releases()
    env = Environment(loader=FileSystemLoader('templates'))
    album_template = env.get_template('album_template.html')
    single_template = env.get_template('single_template.html')

    # Track used slugs and their types
    slug_type_map = {}

    # Generate individual release pages
    for release in releases:
        slug = release['slug']
        rtype = release['type']
        filename = slug
        # If this slug was already used with a different type, append type
        if slug in slug_type_map and slug_type_map[slug] != rtype:
            filename = f"{slug}-{rtype}"
        # Update the map (so future duplicates get type appended)
        slug_type_map[slug] = rtype
        if rtype in ['album', 'ep']:
            out_path = f"releases/lp-ep/{filename}.html"
            html = album_template.render(release=release)
        else:
            out_path = f"releases/singles/{filename}.html"
            html = single_template.render(release=release)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)

    # Update discography.html gallery (placeholder)
    # TODO: Implement actual gallery update logic
    print('Discography and release pages updated.')

if __name__ == '__main__':
    main() 