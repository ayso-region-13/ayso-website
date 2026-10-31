// The two areas /ayso field sets. Pure, so it can be tested without Slack.

const AREA_NAMES = { laCanada: 'La Cañada', pasadena: 'Pasadena/Altadena' };

/** What fieldstatus.json stores. The bar splits only on this status, so a later
 *  plain status always wins over area values left in the file. */
export function fieldStatusFrom(laCanada, pasadena) {
  if (laCanada === pasadena) return { status: laCanada, laCanadaStatus: '', pasadenaStatus: '' };
  return { status: 'Varies by area', laCanadaStatus: laCanada, pasadenaStatus: pasadena };
}

/** The status as one line, for the Slack post and the commit message. */
export function fieldStatusHeadline(laCanada, pasadena) {
  if (laCanada === pasadena) return laCanada;
  return `${AREA_NAMES.laCanada} ${laCanada}, ${AREA_NAMES.pasadena} ${pasadena}`;
}
