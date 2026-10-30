// The two areas /ayso field sets. Pure, so it can be tested without Slack.

const AREA_NAMES = { laCanada: 'La Cañada', pasadena: 'Pasadena/Altadena' };

/** What fieldstatus.json stores. The per-area values are set only when the areas
 *  differ, so a stale one can never split the bar on a normal day. */
export function fieldStatusFrom(laCanada, pasadena) {
  if (laCanada === pasadena) return { status: laCanada, laCanadaStatus: '', pasadenaStatus: '' };
  const anyClosed = laCanada === 'Closed' || pasadena === 'Closed';
  return { status: anyClosed ? 'Partly closed' : 'Monitoring', laCanadaStatus: laCanada, pasadenaStatus: pasadena };
}

/** The status as one line, for the Slack post and the commit message. */
export function fieldStatusHeadline(laCanada, pasadena) {
  if (laCanada === pasadena) return laCanada;
  return `${AREA_NAMES.laCanada} ${laCanada}, ${AREA_NAMES.pasadena} ${pasadena}`;
}
