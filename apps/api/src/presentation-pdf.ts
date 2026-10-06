import PDFDocument from 'pdfkit';

export type PresentationSheet = { title: string; subtitle: string; image: Buffer };

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
    pdf.image(sheet.image, 40, 105, { fit: [880, 350], align: 'center', valign: 'center' });
    pdf.fillColor('#244039').font('Helvetica').fontSize(10).text(sheet.subtitle, 40, 468, { width: 880, height: 30 });
  }
  page('DESIGN REVIEW');
  pdf.font('Times-Roman').fontSize(42).text('Thank you', 100, 220, { width: 760, align: 'center' });
  pdf.font('Helvetica').fontSize(13).text('Review finishes, room layouts and drawings before manufacturing release.', 160, 305, { width: 640, align: 'center' });
  pdf.end(); return completed;
}
