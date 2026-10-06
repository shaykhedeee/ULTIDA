import PDFDocument from 'pdfkit';

export type PresentationSheet = { title: string; subtitle: string; image?: Buffer; rows?: Array<{ label: string; detail: string; colorHex?: string }>; layout?: 'schedule' | 'moodboard' };

/** Client review deck: images and drawings retain their saved revision provenance. */
export async function buildPresentationPdf(projectName: string, revision: string, sheets: PresentationSheet[]): Promise<Buffer> {
  const pdf = new PDFDocument({ size: [960, 540], margin: 0, autoFirstPage: false, info: { Title: `${projectName} — Design presentation`, Author: 'ULTIDA' } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(Buffer.from(chunk)));
    pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
  });
  let pageNumber = 0;
  const page = (title: string) => {
    pageNumber += 1;
    pdf.addPage(); pdf.rect(0, 0, 960, 540).fill('#deddd0');
    pdf.rect(0, 508, 960, 32).fill('#a5b18c');
    pdf.fillColor('#244039').font('Helvetica-Bold').fontSize(12).text('ULTIDA', 40, 24);
    pdf.font('Helvetica').fontSize(9).text(`Saved revision ${revision}`, 600, 26, { width: 320, align: 'right' });
    pdf.fontSize(10).text(title, 40, 518, { width: 800 });
    pdf.text(String(pageNumber), 890, 518, { width: 30, align: 'right' });
  };
  page('DESIGN PRESENTATION');
  pdf.font('Helvetica').fontSize(16).text('CLIENT DESIGN REVIEW', 100, 165, { width: 760, align: 'center' });
  pdf.font('Times-Roman').fontSize(38).text(projectName, 100, 205, { width: 760, align: 'center', height: 105 });
  pdf.fontSize(27).text('3D & 2D DESIGN SHEETS', 100, 322, { width: 760, align: 'center' });
  pdf.font('Helvetica').fontSize(11).text('Presentation images support design review. Construction dimensions come from approved drawings.', 160, 420, { width: 640, align: 'center' });
  for (const sheet of sheets) {
    page(sheet.title); pdf.font('Times-Roman').fontSize(25).text(sheet.title, 40, 60, { width: 880, height: 38 });
    if (sheet.image) pdf.image(sheet.image, 40, 105, { fit: [880, 350], align: 'center', valign: 'center' });
    if (sheet.rows) {
      const limit = sheet.layout === 'moodboard' ? 6 : 8;
      if (sheet.rows.length > limit) throw new Error(`Presentation sheet ${sheet.title} exceeds its readable row limit.`);
      sheet.rows.forEach((row, index) => {
        const board = sheet.layout === 'moodboard';
        const x = board ? 40 + index % 3 * 298 : 40;
        const y = board ? 110 + Math.floor(index / 3) * 168 : 110 + index * 42;
        pdf.rect(x, y, board ? 280 : 880, board ? 154 : 38).fill('#faf8f3');
        if (board) {
          if (row.colorHex && /^#[0-9a-fA-F]{6}$/.test(row.colorHex)) pdf.rect(x + 12, y + 12, 256, 54).fill(row.colorHex);
          else pdf.fillColor('#244039').font('Helvetica').fontSize(10).text('Swatch not specified', x + 12, y + 28, { width: 256 });
        }
        pdf.fillColor('#244039').font('Helvetica-Bold').fontSize(11).text(row.label, x + 12, y + (board ? 76 : 6), { width: board ? 256 : 315, height: board ? 28 : 26 });
        pdf.font('Helvetica').fontSize(10).text(row.detail, x + (board ? 12 : 340), y + (board ? 106 : 6), { width: board ? 256 : 525, height: board ? 38 : 26 });
      });
    }
    pdf.fillColor('#244039').font('Helvetica').fontSize(10).text(sheet.subtitle, 40, 468, { width: 880, height: 30 });
  }
  page('DESIGN REVIEW');
  pdf.font('Times-Roman').fontSize(36).text('Design review & sign-off', 100, 130, { width: 760, align: 'center' });
  pdf.font('Helvetica').fontSize(13).text('Review finishes, room layouts and drawings before manufacturing release.', 160, 210, { width: 640, align: 'center' });
  pdf.fontSize(11).text('Client signature: __________________________     Date: __________________', 140, 310, { width: 700 });
  pdf.text('Designer review: _________________________     Date: __________________', 140, 360, { width: 700 });
  pdf.fontSize(10).text('Blank fields are provided for review. This document does not record a signature or release fabrication automatically.', 140, 425, { width: 700, align: 'center' });
  pdf.end(); return completed;
}
