export type CncPanelSpec = {
  id?: string;
  name?: string;
  widthMm: number;
  lengthMm: number;
  thicknessMm: number;
  panelType: 'gable_left' | 'gable_right' | 'shutter' | 'top_bottom_deck' | 'shelf' | 'back' | string;
  operations?: {
    lineBoring?: boolean;
    hingeBoring?: boolean;
    minifix?: boolean;
    backGroove?: boolean;
  };
};

export function generateWoodWopMpr(panel: CncPanelSpec): string {
  const pWidth = panel.widthMm;
  const pLength = panel.lengthMm;
  const pThickness = panel.thicknessMm;
  const panelType = panel.panelType.toLowerCase();

  const enableLineBoring = panel.operations?.lineBoring ?? (panelType === 'gable_left' || panelType === 'gable_right');
  const enableHingeBoring = panel.operations?.hingeBoring ?? (panelType.includes('shutter') || panelType === 'gable_left' || panelType === 'gable_right');
  const enableMinifix = panel.operations?.minifix ?? (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck');
  const enableBackGroove = panel.operations?.backGroove ?? (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck');

  const lines: string[] = [
    '[H',
    'VERSION="4.0"',
    'OP="1"',
    `_FN="${panel.name ?? panel.id ?? 'PANEL'}"`,
    ']',
    '[001',
    `L="${pLength.toFixed(1)}"`,
    `B="${pWidth.toFixed(1)}"`,
    `D="${pThickness.toFixed(1)}"`,
    'F="1"',
    'MK="0"',
    'KO="0"',
    'AN="1"',
    ']',
  ];

  // 1. Line Boring (BO_V vertical boring)
  if (enableLineBoring && (panelType === 'gable_left' || panelType === 'gable_right')) {
    const startY = 150;
    const endY = pLength - 150;
    const frontX = panelType === 'gable_left' ? 37 : pWidth - 37;
    const rearX = panelType === 'gable_left' ? pWidth - 37 : 37;
    for (let y = startY; y <= endY; y += 32) {
      lines.push(
        '<100 \\BO_V\\',
        `XA="${frontX.toFixed(1)}"`,
        `YA="${y.toFixed(1)}"`,
        'TI="13.0"',
        'DU="5.0"',
        'BM="LS"',
        'MN="DRILL"',
        '>',
        '<100 \\BO_V\\',
        `XA="${rearX.toFixed(1)}"`,
        `YA="${y.toFixed(1)}"`,
        'TI="13.0"',
        'DU="5.0"',
        'BM="LS"',
        'MN="DRILL"',
        '>'
      );
    }
  }

  // 2. Hinge Boring
  if (enableHingeBoring) {
    if (panelType.includes('shutter')) {
      const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
      const positions: number[] = [100, pLength - 100];
      if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
      if (hingeCount >= 4) positions.push(250);
      if (hingeCount >= 5) positions.push(pLength - 250);

      for (const y of positions.sort((a, b) => a - b)) {
        lines.push(
          '<100 \\BO_V\\',
          'XA="21.5"',
          `YA="${y.toFixed(1)}"`,
          'TI="12.5"',
          'DU="35.0"',
          'BM="LS"',
          'MN="HINGE_35"',
          '>',
          '<100 \\BO_V\\',
          'XA="31.0"',
          `YA="${(y - 22.5).toFixed(1)}"`,
          'TI="11.0"',
          'DU="8.0"',
          'BM="LS"',
          'MN="DRILL"',
          '>',
          '<100 \\BO_V\\',
          'XA="31.0"',
          `YA="${(y + 22.5).toFixed(1)}"`,
          'TI="11.0"',
          'DU="8.0"',
          'BM="LS"',
          'MN="DRILL"',
          '>'
        );
      }
    } else if (panelType === 'gable_left' || panelType === 'gable_right') {
      const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
      const positions: number[] = [100, pLength - 100];
      if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
      if (hingeCount >= 4) positions.push(250);
      if (hingeCount >= 5) positions.push(pLength - 250);

      const hingeX = panelType === 'gable_left' ? 37 : pWidth - 37;
      for (const y of positions.sort((a, b) => a - b)) {
        lines.push(
          '<100 \\BO_V\\',
          `XA="${hingeX.toFixed(1)}"`,
          `YA="${(y - 16).toFixed(1)}"`,
          'TI="11.0"',
          'DU="5.0"',
          'BM="LS"',
          'MN="DRILL"',
          '>',
          '<100 \\BO_V\\',
          `XA="${hingeX.toFixed(1)}"`,
          `YA="${(y + 16).toFixed(1)}"`,
          'TI="11.0"',
          'DU="5.0"',
          'BM="LS"',
          'MN="DRILL"',
          '>'
        );
      }
    }
  }

  // 3. Minifix Cam & Dowels
  if (enableMinifix) {
    if (panelType === 'gable_left' || panelType === 'gable_right') {
      const levels = [pThickness / 2, pLength - pThickness / 2];
      const xPos = [50, pWidth - 80];
      for (const y of levels) {
        for (const x of xPos) {
          lines.push(
            '<100 \\BO_V\\',
            `XA="${x.toFixed(1)}"`,
            `YA="${y.toFixed(1)}"`,
            'TI="14.0"',
            'DU="5.0"',
            'BM="LS"',
            'MN="DRILL"',
            '>',
            '<100 \\BO_V\\',
            `XA="${(x + 32).toFixed(1)}"`,
            `YA="${y.toFixed(1)}"`,
            'TI="14.0"',
            'DU="8.0"',
            'BM="LS"',
            'MN="DRILL"',
            '>'
          );
        }
      }
    } else if (panelType === 'top_bottom_deck') {
      const camY = [34, pLength - 34];
      const camX = [50, pWidth - 80];
      for (const y of camY) {
        for (const x of camX) {
          lines.push(
            '<100 \\BO_V\\',
            `XA="${x.toFixed(1)}"`,
            `YA="${y.toFixed(1)}"`,
            'TI="13.5"',
            'DU="15.0"',
            'BM="LS"',
            'MN="MINIFIX_15"',
            '>'
          );
        }
      }
    }
  }

  // 4. Back Panel Groove
  if (enableBackGroove && (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck')) {
    const grooveX = panelType === 'gable_left' ? pWidth - 15 : 15;
    lines.push(
      '<102 \\SAW\\',
      `XA="${grooveX.toFixed(1)}"`,
      'YA="0.0"',
      `XE="${grooveX.toFixed(1)}"`,
      `YE="${pLength.toFixed(1)}"`,
      'TI="8.0"',
      'ZB="6.0"',
      'BM="LS"',
      '>'
    );
  }

  lines.push('[!]');
  return lines.join('\r\n') + '\r\n';
}

export function generateBiesseCix(panel: CncPanelSpec): string {
  const pWidth = panel.widthMm;
  const pLength = panel.lengthMm;
  const pThickness = panel.thicknessMm;
  const panelType = panel.panelType.toLowerCase();

  const enableLineBoring = panel.operations?.lineBoring ?? (panelType === 'gable_left' || panelType === 'gable_right');
  const enableHingeBoring = panel.operations?.hingeBoring ?? (panelType.includes('shutter') || panelType === 'gable_left' || panelType === 'gable_right');
  const enableMinifix = panel.operations?.minifix ?? (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck');
  const enableBackGroove = panel.operations?.backGroove ?? (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck');

  const lines: string[] = [
    'BEGIN ID CID3',
    '  REL= 3.0',
    '  AXIS= X, Y, Z',
    'BEGIN MACRO',
    '  NAME=PAN',
    `  PARAM,LNX=${pWidth.toFixed(1)}`,
    `  PARAM,LNY=${pLength.toFixed(1)}`,
    `  PARAM,LNZ=${pThickness.toFixed(1)}`,
    '  PARAM,ALW=0',
    '  PARAM,ALH=0',
    '  PARAM,OVS=0',
    'END MACRO',
  ];

  const addBore = (x: number, y: number, dia: number, dp: number) => {
    lines.push(
      'BEGIN MACRO',
      '  NAME=BORE',
      '  PARAM,SIDE=1',
      `  PARAM,X=${x.toFixed(1)}`,
      `  PARAM,Y=${y.toFixed(1)}`,
      `  PARAM,DIA=${dia.toFixed(1)}`,
      `  PARAM,DP=${dp.toFixed(1)}`,
      'END MACRO'
    );
  };

  // 1. Line Boring
  if (enableLineBoring && (panelType === 'gable_left' || panelType === 'gable_right')) {
    const startY = 150;
    const endY = pLength - 150;
    const frontX = panelType === 'gable_left' ? 37 : pWidth - 37;
    const rearX = panelType === 'gable_left' ? pWidth - 37 : 37;
    for (let y = startY; y <= endY; y += 32) {
      addBore(frontX, y, 5.0, 13.0);
      addBore(rearX, y, 5.0, 13.0);
    }
  }

  // 2. Hinge Boring
  if (enableHingeBoring) {
    if (panelType.includes('shutter')) {
      const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
      const positions: number[] = [100, pLength - 100];
      if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
      if (hingeCount >= 4) positions.push(250);
      if (hingeCount >= 5) positions.push(pLength - 250);

      for (const y of positions.sort((a, b) => a - b)) {
        addBore(21.5, y, 35.0, 12.5);
        addBore(31.0, y - 22.5, 8.0, 11.0);
        addBore(31.0, y + 22.5, 8.0, 11.0);
      }
    } else if (panelType === 'gable_left' || panelType === 'gable_right') {
      const hingeCount = pLength > 2100 ? 5 : pLength > 1600 ? 4 : pLength > 1000 ? 3 : 2;
      const positions: number[] = [100, pLength - 100];
      if (hingeCount >= 3) positions.push(Math.round(pLength / 2));
      if (hingeCount >= 4) positions.push(250);
      if (hingeCount >= 5) positions.push(pLength - 250);

      const hingeX = panelType === 'gable_left' ? 37 : pWidth - 37;
      for (const y of positions.sort((a, b) => a - b)) {
        addBore(hingeX, y - 16, 5.0, 11.0);
        addBore(hingeX, y + 16, 5.0, 11.0);
      }
    }
  }

  // 3. Minifix Cam & Dowels
  if (enableMinifix) {
    if (panelType === 'gable_left' || panelType === 'gable_right') {
      const levels = [pThickness / 2, pLength - pThickness / 2];
      const xPos = [50, pWidth - 80];
      for (const y of levels) {
        for (const x of xPos) {
          addBore(x, y, 5.0, 14.0);
          addBore(x + 32, y, 8.0, 14.0);
        }
      }
    } else if (panelType === 'top_bottom_deck') {
      const camY = [34, pLength - 34];
      const camX = [50, pWidth - 80];
      for (const y of camY) {
        for (const x of camX) {
          addBore(x, y, 15.0, 13.5);
        }
      }
    }
  }

  // 4. Back Panel Groove
  if (enableBackGroove && (panelType === 'gable_left' || panelType === 'gable_right' || panelType === 'top_bottom_deck')) {
    const grooveX = panelType === 'gable_left' ? pWidth - 15 : 15;
    lines.push(
      'BEGIN MACRO',
      '  NAME=BG',
      '  PARAM,ID="BACK_GROOVE"',
      '  PARAM,SIDE=1',
      `  PARAM,X=${grooveX.toFixed(1)}`,
      '  PARAM,Y=0.0',
      `  PARAM,L=${pLength.toFixed(1)}`,
      '  PARAM,DP=8.0',
      '  PARAM,TH=6.0',
      'END MACRO'
    );
  }

  lines.push('END ID CID3');
  return lines.join('\r\n') + '\r\n';
}

export interface TarFileEntry {
  name: string;
  content: string | Uint8Array;
}

/**
 * Creates a standard POSIX USTAR .tar archive in pure TypeScript.
 * Universally extractable by Windows (native tar), 7-Zip, macOS, and Linux without any dependencies.
 */
export function createTarArchive(files: TarFileEntry[]): Uint8Array {
  let totalBytes = 0;
  const processed = files.map((f) => {
    const bytes = typeof f.content === 'string' ? new TextEncoder().encode(f.content) : f.content;
    const padded = Math.ceil(bytes.length / 512) * 512;
    totalBytes += 512 + padded;
    return { name: f.name, bytes, padded };
  });
  totalBytes += 1024; // End-of-archive marker (2 x 512 zero blocks)

  const tar = new Uint8Array(totalBytes);
  let offset = 0;

  for (const { name, bytes, padded } of processed) {
    const header = new Uint8Array(512);
    const nameBytes = new TextEncoder().encode(name);
    header.set(nameBytes.subarray(0, 100), 0);
    // File mode: 0000644\0
    header.set(new TextEncoder().encode('0000644\0'), 100);
    // UID: 0000000\0
    header.set(new TextEncoder().encode('0000000\0'), 108);
    // GID: 0000000\0
    header.set(new TextEncoder().encode('0000000\0'), 116);
    // File size in octal: 11 digits + space
    const sizeOctal = bytes.length.toString(8).padStart(11, '0') + ' ';
    header.set(new TextEncoder().encode(sizeOctal), 124);
    // mtime
    const mtimeOctal = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + ' ';
    header.set(new TextEncoder().encode(mtimeOctal), 136);
    // Checksum placeholder: 8 spaces (ASCII 32)
    for (let i = 148; i < 156; i++) header[i] = 32;
    // Typeflag: regular file ('0')
    header[156] = 48;
    // Magic: ustar\0
    header.set(new TextEncoder().encode('ustar\0'), 257);
    // Version: 00
    header.set(new TextEncoder().encode('00'), 263);

    // Compute checksum sum
    let chksum = 0;
    for (let i = 0; i < 512; i++) chksum += header[i];
    const chksumOctal = chksum.toString(8).padStart(6, '0') + '\0 ';
    header.set(new TextEncoder().encode(chksumOctal), 148);

    tar.set(header, offset);
    offset += 512;
    tar.set(bytes, offset);
    offset += padded;
  }

  return tar;
}

export function generateWoodWopBatch(panels: CncPanelSpec[]): TarFileEntry[] {
  return panels.map((p, idx) => {
    const rawName = p.name ?? p.id ?? `PANEL_${idx + 1}`;
    const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${String(idx + 1).padStart(2, '0')}_${cleanName}_${p.lengthMm}x${p.widthMm}.mpr`;
    return {
      name: filename,
      content: generateWoodWopMpr(p),
    };
  });
}

export function generateBiesseBatch(panels: CncPanelSpec[]): TarFileEntry[] {
  return panels.map((p, idx) => {
    const rawName = p.name ?? p.id ?? `PANEL_${idx + 1}`;
    const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${String(idx + 1).padStart(2, '0')}_${cleanName}_${p.lengthMm}x${p.widthMm}.cix`;
    return {
      name: filename,
      content: generateBiesseCix(p),
    };
  });
}

