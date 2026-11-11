import base64
import csv
import hmac
import io
import json
import os
import pathlib
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer


def extract(content, mime_type):
    with tempfile.TemporaryDirectory() as directory:
        root = pathlib.Path(directory)
        source = root / 'source'
        source.write_bytes(content)
        if mime_type == 'application/pdf':
            subprocess.run(['pdftoppm', '-f', '1', '-l', '5', '-r', '150', '-png', str(source), str(root / 'page')], check=True, timeout=15, capture_output=True)
            pages = sorted(root.glob('page-*.png'))
        else:
            pages = [source]
        words, confidence = [], []
        for page in pages:
            result = subprocess.run(['tesseract', str(page), 'stdout', '-l', 'eng', 'tsv'], check=True, capture_output=True, text=True, timeout=20)
            last_line = None
            for row in csv.DictReader(io.StringIO(result.stdout), delimiter='\t'):
                if row.get('text', '').strip():
                    line = (row['page_num'], row['block_num'], row['par_num'], row['line_num'])
                    if last_line is not None and line != last_line:
                        words.append('\n')
                    words.append(row['text'])
                    last_line = line
                    if float(row['conf']) >= 0:
                        confidence.append(float(row['conf']) / 100)
            words.append('\n')
        return {'text': ' '.join(words).strip(), 'confidence': sum(confidence) / len(confidence) if confidence else None, 'pageLimit': 5}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        secret = os.environ.get('JOBS_SECRET', '')
        if len(secret) < 24 or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret):
            self.send_error(401)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0 or length > 7 * 1024 * 1024:
            self.send_error(413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
            content = base64.b64decode(payload['contentBase64'], validate=True)
            if len(content) > 5 * 1024 * 1024:
                raise ValueError('File too large')
            result = extract(content, payload['mimeType'])
            body = json.dumps(result).encode()
            self.send_response(200)
        except Exception:
            body = json.dumps({'error': 'OCR could not process this document. Review the original manually.'}).encode()
            self.send_response(422)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
