"""Render Terminal spec markdown files to PDF (markdown-pdf / PyMuPDF)."""
import sys
from pathlib import Path

from markdown_pdf import MarkdownPdf, Section

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "pdf"

# Segoe UI covers ₦ (U+20A6); fall back handled by PyMuPDF if needed.
CSS = """
body { font-family: 'Segoe UI', sans-serif; font-size: 10pt; line-height: 1.45; color: #16181D; }
h1 { font-size: 19pt; color: #16181D; border-bottom: 3px solid #F59E0B; padding-bottom: 4px; }
h2 { font-size: 13.5pt; border-bottom: 1px solid #D7DAE0; padding-bottom: 2px; margin-top: 18px; }
h3 { font-size: 11pt; margin-top: 14px; }
table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
th, td { border: 1px solid #B9BDC7; padding: 3px 6px; text-align: left; }
th { background-color: #EDEEF1; }
code { font-family: 'Consolas', monospace; font-size: 8.5pt; background-color: #EDEEF1; }
pre { background-color: #F2F3F5; font-size: 8pt; padding: 8px; }
blockquote { border-left: 4px solid #F59E0B; padding-left: 12px; background-color: #FEF3C7; }
"""

def render(md_path: Path, pdf_path: Path, title: str) -> None:
    text = md_path.read_text(encoding="utf-8")
    pdf = MarkdownPdf(toc_level=3, optimize=True)
    pdf.add_section(Section(text, paper_size="A4"), user_css=CSS)
    pdf.meta["title"] = title
    pdf.meta["author"] = "Nwabueze Chigozirim Victor / Terminal"
    pdf.save(str(pdf_path))
    print(f"OK {pdf_path.name} ({pdf_path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    # Canonical specs moved to docs/ under D-031; docs/v2/06_FSD_v2.md and
    # docs/v2/07_TSD.md are now pointers and must not be rendered.
    render(ROOT / "docs/perblis-terminal-FSD.md", OUT / "Terminal_FSD_v2.1.pdf",
           "Terminal - Functional Specification Document v2.1")
    render(ROOT / "docs/perblis-terminal-TSD.md", OUT / "Terminal_TSD_v2.1.pdf",
           "Terminal - Technical Specification Document v2.1")
    sys.exit(0)
