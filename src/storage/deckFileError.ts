/** Why a deck file could not be opened: each kind has its own message in the editor (SV-3). */
export type DeckFileProblem = 'not-a-zip' | 'not-cue' | 'newer' | 'damaged' | 'too-large';

export class DeckFileError extends Error {
  override readonly name = 'DeckFileError';
  constructor(
    readonly problem: DeckFileProblem,
    message: string,
    /** For `newer`: the version the file was made with. */
    readonly version?: number,
  ) {
    super(message);
  }
}

export const FILE_EXTENSION = '.slides';
export const FILE_TYPE = 'application/zip';
