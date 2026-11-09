#!/usr/bin/env python3
"""Verify repository download sizes, SHA-256 checksums, and methodology links."""
import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / 'raw-images'
PREFIX = 'https://github.com/jmarkey2/lincoln-square-maps/raw/refs/heads/main/raw-images/'

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.urls.append(dict(attrs).get('href', ''))


def main():
    parser = Links()
    parser.feed((ROOT / 'site/index.html').read_text())
    manifest = json.loads((DOWNLOADS / 'manifest.json').read_text())
    expected = set()
    for entry in manifest:
        path = DOWNLOADS / entry['file']
        assert path.is_file(), f'Missing download: {path}'
        assert path.stat().st_size == entry['bytes'], f'Size mismatch: {path}'
        assert path.stat().st_size < 100 * 1024**2, f'GitHub file limit exceeded: {path}'
        with path.open('rb') as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == entry['sha256'], f'Checksum mismatch: {path}'
        expected.add(PREFIX + entry['file'])
        print(f'{entry["file"]}: verified, {entry["bytes"]/1024**2:.2f} MiB')
    actual = {url for url in parser.urls if url.startswith(PREFIX)}
    assert actual == expected, 'Methodology download links do not match the manifest'
    print(f'PASS: {len(manifest)} downloads match checksums, GitHub file limits, and methodology URLs.')


if __name__ == '__main__':
    main()
