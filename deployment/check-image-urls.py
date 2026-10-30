"""Check that every study image URL loads before launch. Read-only: it only downloads the images.

Input: a CSV with columns Id,ImageUrl, for example exported from the prepared database:
  psql "<connection>" -X -c "\\copy (SELECT \\"Id\\", \\"ImageUrl\\" FROM \\"MedDatas\\" ORDER BY \\"Id\\") TO 'image-urls.csv' CSV HEADER"
Usage:
  python -I deployment/check-image-urls.py image-urls.csv [report.csv]

A server-side check approximates a participant's browser; still open a few images in the study browsers.
With Pillow installed the report also lists each image's size and EXIF data. Browsers apply EXIF rotation and may
apply EXIF resolution, so saved coordinates for flagged images differ from the file's stored pixels.
"""
import csv
import io
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

try:
    from PIL import Image
except ImportError:
    Image = None

HEADERS = {
    # Some publishers reject unknown clients; identify like a current desktop browser.
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
}
ORIENTATION, X_RESOLUTION, EXIF_IFD, PIXEL_X = 0x0112, 0x011A, 0x8769, 0xA002


def describe(body):
    """Returns (format, width, height, EXIF rotation, whether EXIF can change the browser's reported size)."""
    if Image is None:
        return '', '', '', '', ''
    try:
        with Image.open(io.BytesIO(body)) as image:
            exif = image.getexif()
            resized = bool(exif.get(X_RESOLUTION)) and bool(exif.get_ifd(EXIF_IFD).get(PIXEL_X))
            return image.format, image.width, image.height, exif.get(ORIENTATION, 1), resized
    except Exception as error:  # not decodable by Pillow, e.g. SVG; the browser may still show it
        return f'unreadable:{type(error).__name__}', '', '', '', ''


def check(row):
    image_id, url = row['Id'], (row.get('ImageUrl') or '').strip()
    empty = ('', '', '', '', '')
    if not url.lower().startswith(('https://', 'http://')):
        return (image_id, url, 'invalid-url', '', 0) + empty
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
            body = response.read()
            content_type = response.headers.get('Content-Type', '')
            ok = response.status == 200 and content_type.startswith('image/') and len(body) > 0
            return (image_id, url, 'ok' if ok else f'http-{response.status}', content_type, len(body)) + describe(body)
    except urllib.error.HTTPError as error:
        return (image_id, url, f'http-{error.code}', '', 0) + empty
    except Exception as error:  # timeouts, DNS, TLS
        return (image_id, url, type(error).__name__, '', 0) + empty


def main():
    source = sys.argv[1]
    report = sys.argv[2] if len(sys.argv) > 2 else 'image-url-report.csv'
    with open(source, newline='', encoding='utf-8-sig') as handle:
        rows = list(csv.DictReader(handle))
    if not rows or 'ImageUrl' not in rows[0]:
        sys.exit(f'No Id,ImageUrl rows found in {source}; nothing was checked.')
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, rows))
    with open(report, 'w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['Id', 'ImageUrl', 'Result', 'ContentType', 'Bytes', 'Format', 'Width', 'Height', 'ExifRotation', 'ExifResolution'])
        writer.writerows(results)
    failures = [result for result in results if result[2] != 'ok']
    insecure = [result for result in results if result[1].lower().startswith('http://')]
    print(f'{len(results) - len(failures)}/{len(results)} images loaded; report: {report}')
    if insecure:
        print(f'{len(insecure)} URLs use http:// and will be blocked or warned about on the HTTPS site.')
    if Image is None:
        print('Pillow is not installed, so image sizes and EXIF data were not checked.')
    rotated = [result[0] for result in results if result[8] not in ('', 1)]
    resized = [result[0] for result in results if result[9] is True]
    unreadable = [result[0] for result in results if str(result[5]).startswith('unreadable')]
    if rotated:
        print(f'{len(rotated)} images have EXIF rotation; coordinates use the upright image: {", ".join(rotated[:20])}')
    if resized:
        print(f'{len(resized)} images have EXIF resolution data; a browser may report another size: {", ".join(resized[:20])}')
    if unreadable:
        print(f'{len(unreadable)} images could not be decoded here; open them in a browser: {", ".join(unreadable[:20])}')
    for result in failures[:20]:
        print(f'  FAIL {result[0]}: {result[2]} {result[1]}')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
