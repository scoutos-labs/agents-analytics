export interface TimeSeriesPoint {
  bucket: string;
  value: number;
  group?: string;
}
