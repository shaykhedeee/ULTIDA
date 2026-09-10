export function formatDualMm(mm: number): string {
  if (!Number.isFinite(mm)) return '0 mm [0"]';
  const roundedMm = Math.round(mm);
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const remInches = totalInches - feet * 12;
  const wholeInches = Math.floor(remInches);
  const fraction = remInches - wholeInches;

  const eighths = Math.round(fraction * 8);
  let inchVal = wholeInches;
  let fracStr = '';

  if (eighths === 8) {
    inchVal += 1;
  } else if (eighths === 7) {
    fracStr = '⅞';
  } else if (eighths === 6) {
    fracStr = '¾';
  } else if (eighths === 5) {
    fracStr = '⅝';
  } else if (eighths === 4) {
    fracStr = '½';
  } else if (eighths === 3) {
    fracStr = '⅜';
  } else if (eighths === 2) {
    fracStr = '¼';
  } else if (eighths === 1) {
    fracStr = '⅛';
  }

  let finalFeet = feet;
  if (inchVal === 12) {
    finalFeet += 1;
    inchVal = 0;
  }

  const inchDisplay = inchVal === 0 && fracStr ? fracStr : `${inchVal}${fracStr}`;
  if (finalFeet === 0) {
    return `${roundedMm} mm [${inchDisplay}"]`;
  }
  return `${roundedMm} mm [${finalFeet}' ${inchDisplay}"]`;
}
