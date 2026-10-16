export interface Migration {
  from: number;
  to: number;
  /** Matches the file name, e.g. "001-initial". */
  name: string;
  migrate(data: unknown): unknown;
}
