"""Build the same journal as the portal for the iPhone's offline Web folder."""

from pathlib import Path
import re
from shutil import copyfile
import sys
from tempfile import TemporaryDirectory
from urllib.parse import urljoin


REPO = Path(__file__).resolve().parents[1]
PUBLIC = REPO / "public"
ENTRY = "projets/carnet-sante/index.html"
sys.path.insert(0, str(REPO / "portal"))

from carnet_sante import build_carnet  # noqa: E402


def assemble(output):
    with TemporaryDirectory(prefix="mieux-vivre-") as work:
        projects = Path(work) / "projets"
        carnet = projects / "carnet-sante"
        carnet.mkdir(parents=True)
        copyfile(PUBLIC / "projets/carnet-sante/home.html", carnet / "home.html")
        build_carnet(projects)
        html = (Path(work) / ENTRY).read_text(encoding="utf-8")

    assets = set()

    def add_asset(base, relative):
        path = urljoin("/" + base, relative).lstrip("/")
        assets.add(path)
        return path

    def rebase(match):
        attribute, relative = match.groups()
        return f'{attribute}="./{add_asset(ENTRY, relative)}"'

    # Keep Web/index.html so the app retains the entry point used by earlier versions.
    html = re.sub(r'\b(src|href)="((?:\.\.?/)[^"]+)"', rebase, html)
    for path in sorted(assets):
        if not path.endswith(".css"):
            continue
        style = (PUBLIC / path).read_text(encoding="utf-8")
        for relative in re.findall(r'url\(\s*["\']?((?:\.\.?/)[^)"\']+)\s*["\']?\)', style):
            add_asset(path, relative)
    # Native launches directly from the bundle, without installing a web manifest.
    manifest = "projets/carnet-sante/manifest.webmanifest"
    html = re.sub(r'<link rel="manifest"[^>]+>', '', html)
    assets.discard(manifest)
    if "brand/bricolage-grotesque-latin.woff2" in assets:
        assets.add("brand/bricolage-grotesque-OFL.txt")
    images = PUBLIC / "projets/carnet-sante/catalogue-images"
    assets.update(path.relative_to(PUBLIC).as_posix() for path in images.rglob("*") if path.is_file())

    for path in sorted(assets):
        source = (PUBLIC / path).resolve()
        if not source.is_relative_to(PUBLIC) or not source.is_file():
            raise ValueError(f"Ressource du carnet introuvable : {path}")
        bundle_file = output / path
        bundle_file.parent.mkdir(parents=True, exist_ok=True)
        copyfile(source, bundle_file)
    (output / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    assemble(Path(sys.argv[1]))
